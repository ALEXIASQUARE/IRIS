import { BookingsService } from '../bookings.service';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BookingStatus, PaymentStatus } from '@prisma/client';

// Couvre §5.3 (orchestration devis -> paiement -> matching), §21.14 (devis
// toujours recalculé serveur) et la politique d'annulation — mentionné
// comme manquant dans le README ("reste à couvrir bookings").

function buildDeps(overrides: Partial<Record<string, any>> = {}) {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({ phone: '+237600000001' }),
      ...overrides.prisma?.user,
    },
    address: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'address-1',
        userId: 'client-1',
        zoneId: 'zone-1',
        zone: { id: 'zone-1', isActive: true, countryId: 'country-1' },
      }),
      ...overrides.prisma?.address,
    },
    serviceCategory: {
      findUnique: jest.fn().mockResolvedValue({ id: 'cat-1', isActive: true }),
      ...overrides.prisma?.serviceCategory,
    },
    booking: {
      create: jest.fn().mockResolvedValue({ id: 'booking-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn().mockResolvedValue({
        id: 'booking-1',
        clientId: 'client-1',
        status: BookingStatus.SEARCHING_PARTNER,
        assignedPartner: null,
      }),
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      ...overrides.prisma?.booking,
    },
    partnerProfile: {
      update: jest.fn().mockResolvedValue({}),
      ...overrides.prisma?.partnerProfile,
    },
    $transaction: jest.fn((ops: any) => Promise.all(ops)),
  };

  const pricing = {
    computeLaundryQuote: jest.fn().mockResolvedValue({
      pricingConfigId: 'config-1',
      currency: 'XAF',
      subtotal: 600,
      total: 1300,
      requiresManualQuote: false,
    }),
    computeGenericQuote: jest.fn().mockResolvedValue({
      pricingConfigId: 'config-1',
      currency: 'XAF',
      subtotal: 2000,
      total: 2700,
      requiresManualQuote: false,
    }),
    ...overrides.pricing,
  };

  const payments = {
    initiatePayment: jest.fn().mockResolvedValue({ status: PaymentStatus.SUCCESS }),
    ...overrides.payments,
  };

  const missions = {
    searchAndBroadcastPartner: jest.fn().mockResolvedValue(undefined),
    ...overrides.missions,
  };

  return { prisma, pricing, payments, missions };
}

describe('BookingsService — createBooking', () => {
  it("refuse une adresse qui n'appartient pas au client", async () => {
    const { prisma, pricing, payments, missions } = buildDeps({
      prisma: {
        address: {
          findUnique: jest.fn().mockResolvedValue({ id: 'address-1', userId: 'un-autre-client', zone: { isActive: true } }),
        },
      },
    });
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await expect(
      service.createBooking(
        { serviceCategoryId: 'cat-1', addressId: 'address-1', laundryItems: [{ garmentTypeId: 'g1', quantity: 1 }] } as any,
        'client-1',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('refuse une commande dans une zone inactive', async () => {
    const { prisma, pricing, payments, missions } = buildDeps({
      prisma: {
        address: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'address-1',
            userId: 'client-1',
            zoneId: 'zone-1',
            zone: { id: 'zone-1', isActive: false },
          }),
        },
      },
    });
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await expect(
      service.createBooking(
        { serviceCategoryId: 'cat-1', addressId: 'address-1', laundryItems: [{ garmentTypeId: 'g1', quantity: 1 }] } as any,
        'client-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuse une catégorie de service introuvable ou inactive', async () => {
    const { prisma, pricing, payments, missions } = buildDeps({
      prisma: { serviceCategory: { findUnique: jest.fn().mockResolvedValue(null) } },
    });
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await expect(
      service.createBooking(
        { serviceCategoryId: 'cat-inconnue', addressId: 'address-1', laundryItems: [{ garmentTypeId: 'g1', quantity: 1 }] } as any,
        'client-1',
      ),
    ).rejects.toThrow(NotFoundException);
  });

  it('refuse la confirmation quand le devis serveur exige un devis manuel, sans initier de paiement', async () => {
    const { prisma, pricing, payments, missions } = buildDeps({
      pricing: {
        computeLaundryQuote: jest.fn().mockResolvedValue({ total: 1000, requiresManualQuote: true }),
      },
    });
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await expect(
      service.createBooking(
        { serviceCategoryId: 'cat-1', addressId: 'address-1', laundryItems: [{ garmentTypeId: 'g1', quantity: 1 }] } as any,
        'client-1',
      ),
    ).rejects.toThrow(BadRequestException);
    expect(payments.initiatePayment).not.toHaveBeenCalled();
  });

  it('recalcule toujours le devis côté serveur (ignore un éventuel prix transmis par le client)', async () => {
    const { prisma, pricing, payments, missions } = buildDeps();
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await service.createBooking(
      {
        serviceCategoryId: 'cat-1',
        addressId: 'address-1',
        laundryItems: [{ garmentTypeId: 'g1', quantity: 1 }],
        total: 1, // simule une tentative du client d'imposer son propre prix.
      } as any,
      'client-1',
    );

    expect(pricing.computeLaundryQuote).toHaveBeenCalled();
    const createCall = prisma.booking.create.mock.calls[0][0];
    expect(createCall.data.estimatedTotal).toBe(1300);
  });

  it('crée la commande directement en recherche de partenaire (paiement différé à l\'arrivée) et déclenche le matching sans initier de paiement', async () => {
    const { prisma, pricing, payments, missions } = buildDeps();
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await service.createBooking(
      {
        serviceCategoryId: 'cat-1',
        addressId: 'address-1',
        laundryItems: [{ garmentTypeId: 'g1', quantity: 1 }],
        paymentProviderCode: 'mtn_momo',
      } as any,
      'client-1',
    );

    const createCall = prisma.booking.create.mock.calls[0][0];
    expect(createCall.data.status).toBe(BookingStatus.SEARCHING_PARTNER);
    expect(createCall.data.paymentProviderCode).toBe('mtn_momo');
    expect(payments.initiatePayment).not.toHaveBeenCalled();
    expect(missions.searchAndBroadcastPartner).toHaveBeenCalledWith('booking-1');
  });
});

// Paiement à l'arrivée (décision produit) : le client n'est jamais débité à
// la création — seulement une fois le partenaire arrivé (statut ARRIVED) et
// toute révision de prix réglée. Mobile money uniquement, aucun cash.
describe('BookingsService — requestArrivalPayment (paiement à l\'arrivée)', () => {
  function buildArrivedBooking(overrides: Partial<Record<string, any>> = {}) {
    return {
      id: 'booking-1',
      clientId: 'client-1',
      status: BookingStatus.ARRIVED,
      paymentProviderCode: 'mtn_momo',
      currency: 'XAF',
      pricingSnapshot: { subtotal: 600 },
      estimatedTotal: 1300,
      finalTotal: null,
      assignedPartner: { userId: 'partner-user-1' },
      ...overrides,
    };
  }

  it('initie le paiement, verrouille ARRIVED->PENDING_PAYMENT, et calcule la commission comme un tiers du sous-total', async () => {
    const { prisma, pricing, payments, missions } = buildDeps({
      prisma: { booking: { findUnique: jest.fn().mockResolvedValue(buildArrivedBooking()) } },
    });
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await service.requestArrivalPayment('booking-1', 'partner-user-1');

    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'booking-1', status: BookingStatus.ARRIVED },
      data: { status: BookingStatus.PENDING_PAYMENT },
    });
    const paymentCall = payments.initiatePayment.mock.calls[0][0];
    expect(paymentCall.providerCode).toBe('mtn_momo');
    expect(paymentCall.amount).toBe(1300);
    // sous-total mocké 600 -> commission = 200, reversé au partenaire = 1300 - 200 = 1100.
    expect(paymentCall.platformCommission).toBe(200);
    expect(paymentCall.partnerPayout).toBe(1100);
  });

  it('impute le delta d\'une révision de prix au sous-total pour recalculer la commission', async () => {
    const { prisma, pricing, payments, missions } = buildDeps({
      prisma: {
        booking: {
          findUnique: jest.fn().mockResolvedValue(buildArrivedBooking({ finalTotal: 1600 })), // +300 vs estimatedTotal
        },
      },
    });
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await service.requestArrivalPayment('booking-1', 'partner-user-1');

    const paymentCall = payments.initiatePayment.mock.calls[0][0];
    expect(paymentCall.amount).toBe(1600);
    // sous-total révisé = 600 + 300 = 900 -> commission = 300, payout = 1600 - 300 = 1300.
    expect(paymentCall.platformCommission).toBe(300);
    expect(paymentCall.partnerPayout).toBe(1300);
  });

  it('confirme immédiatement PAID si le paiement est synchrone SUCCESS', async () => {
    const { prisma, pricing, payments, missions } = buildDeps({
      prisma: { booking: { findUnique: jest.fn().mockResolvedValue(buildArrivedBooking()) } },
      payments: { initiatePayment: jest.fn().mockResolvedValue({ status: PaymentStatus.SUCCESS }) },
    });
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await service.requestArrivalPayment('booking-1', 'partner-user-1');

    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'booking-1', status: BookingStatus.PENDING_PAYMENT },
      data: { status: BookingStatus.PAID },
    });
  });

  it('ne confirme rien si le paiement Mobile Money reste en attente de confirmation', async () => {
    const { prisma, pricing, payments, missions } = buildDeps({
      prisma: { booking: { findUnique: jest.fn().mockResolvedValue(buildArrivedBooking()) } },
      payments: { initiatePayment: jest.fn().mockResolvedValue({ status: PaymentStatus.PENDING_CONFIRMATION }) },
    });
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await service.requestArrivalPayment('booking-1', 'partner-user-1');

    expect(prisma.booking.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: BookingStatus.PAID } }),
    );
  });

  it('refuse si le partenaire n\'est pas celui assigné à la commande', async () => {
    const { prisma, pricing, payments, missions } = buildDeps({
      prisma: { booking: { findUnique: jest.fn().mockResolvedValue(buildArrivedBooking()) } },
    });
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await expect(service.requestArrivalPayment('booking-1', 'un-autre-partenaire')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('refuse si la commande n\'est pas encore au statut ARRIVED (ex: révision de prix en cours)', async () => {
    const { prisma, pricing, payments, missions } = buildDeps({
      prisma: {
        booking: {
          findUnique: jest
            .fn()
            .mockResolvedValue(buildArrivedBooking({ status: BookingStatus.PRICE_REVISION_PENDING })),
        },
      },
    });
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await expect(service.requestArrivalPayment('booking-1', 'partner-user-1')).rejects.toThrow(ConflictException);
  });

  it('refuse une double demande de paiement concurrente (verrou optimiste)', async () => {
    const { prisma, pricing, payments, missions } = buildDeps({
      prisma: {
        booking: {
          findUnique: jest.fn().mockResolvedValue(buildArrivedBooking()),
          updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      },
    });
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await expect(service.requestArrivalPayment('booking-1', 'partner-user-1')).rejects.toThrow(ConflictException);
    expect(payments.initiatePayment).not.toHaveBeenCalled();
  });
});

describe('BookingsService — confirmArrivalPaymentSuccess / revertFailedArrivalPayment / cancelStalePendingPayments', () => {
  it('confirmArrivalPaymentSuccess fait passer PENDING_PAYMENT -> PAID', async () => {
    const { prisma, pricing, payments, missions } = buildDeps();
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await service.confirmArrivalPaymentSuccess('booking-1');

    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'booking-1', status: BookingStatus.PENDING_PAYMENT },
      data: { status: BookingStatus.PAID },
    });
  });

  it('revertFailedArrivalPayment repasse PENDING_PAYMENT -> ARRIVED pour permettre une nouvelle tentative', async () => {
    const { prisma, pricing, payments, missions } = buildDeps();
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await service.revertFailedArrivalPayment('booking-1');

    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'booking-1', status: BookingStatus.PENDING_PAYMENT },
      data: { status: BookingStatus.ARRIVED },
    });
  });

  it('cancelStalePendingPayments annule les commandes bloquées en PENDING_PAYMENT au-delà du délai imparti', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'booking-1' }, { id: 'booking-2' }]);
    const { prisma, pricing, payments, missions } = buildDeps({
      prisma: { booking: { findMany } },
    });
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await service.cancelStalePendingPayments(15);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: BookingStatus.PENDING_PAYMENT }) }),
    );
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'booking-1', status: BookingStatus.PENDING_PAYMENT },
      data: expect.objectContaining({ status: BookingStatus.CANCELLED }),
    });
    expect(prisma.booking.updateMany).toHaveBeenCalledWith({
      where: { id: 'booking-2', status: BookingStatus.PENDING_PAYMENT },
      data: expect.objectContaining({ status: BookingStatus.CANCELLED }),
    });
  });
});

describe('BookingsService — getBooking', () => {
  it('autorise le client propriétaire', async () => {
    const { prisma, pricing, payments, missions } = buildDeps();
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await expect(service.getBooking('booking-1', 'client-1', 'CLIENT')).resolves.toBeDefined();
  });

  it('autorise le partenaire assigné', async () => {
    const { prisma, pricing, payments, missions } = buildDeps({
      prisma: {
        booking: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'booking-1',
            clientId: 'client-1',
            status: BookingStatus.PARTNER_ASSIGNED,
            assignedPartner: { userId: 'partner-user-1' },
          }),
        },
      },
    });
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await expect(service.getBooking('booking-1', 'partner-user-1', 'PARTNER')).resolves.toBeDefined();
  });

  it('autorise le staff (ADMIN)', async () => {
    const { prisma, pricing, payments, missions } = buildDeps();
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await expect(service.getBooking('booking-1', 'un-admin-quelconque', 'ADMIN')).resolves.toBeDefined();
  });

  it("refuse un utilisateur qui n'est ni le client, ni le partenaire assigné, ni du staff", async () => {
    const { prisma, pricing, payments, missions } = buildDeps();
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await expect(service.getBooking('booking-1', 'un-inconnu', 'CLIENT')).rejects.toThrow(ForbiddenException);
  });

  it('lève NotFoundException si la commande n’existe pas', async () => {
    const { prisma, pricing, payments, missions } = buildDeps({
      prisma: { booking: { findUnique: jest.fn().mockResolvedValue(null) } },
    });
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await expect(service.getBooking('booking-inconnu', 'client-1', 'CLIENT')).rejects.toThrow(NotFoundException);
  });
});

describe('BookingsService — cancelBooking', () => {
  it('annule une commande encore annulable et enregistre le motif', async () => {
    const { prisma, pricing, payments, missions } = buildDeps({
      prisma: {
        booking: {
          findUnique: jest.fn().mockResolvedValue({ id: 'booking-1', clientId: 'client-1', status: BookingStatus.SEARCHING_PARTNER }),
        },
      },
    });
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await service.cancelBooking('booking-1', 'client-1', 'changement de plan');

    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: { status: BookingStatus.CANCELLED, cancelledAt: expect.any(Date), cancellationReason: 'changement de plan' },
    });
  });

  it('libère le partenaire assigné (redevient disponible) quand une commande PARTNER_ASSIGNED est annulée', async () => {
    const { prisma, pricing, payments, missions } = buildDeps({
      prisma: {
        booking: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'booking-1',
            clientId: 'client-1',
            status: BookingStatus.PARTNER_ASSIGNED,
            assignedPartnerId: 'partner-1',
          }),
        },
      },
    });
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await service.cancelBooking('booking-1', 'client-1', 'changement de plan');

    expect(prisma.partnerProfile.update).toHaveBeenCalledWith({
      where: { id: 'partner-1' },
      data: { isAvailable: true },
    });
  });

  it("ne touche à aucun partenaire quand la commande n'en avait pas encore (ex: SEARCHING_PARTNER)", async () => {
    const { prisma, pricing, payments, missions } = buildDeps({
      prisma: {
        booking: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'booking-1',
            clientId: 'client-1',
            status: BookingStatus.SEARCHING_PARTNER,
            assignedPartnerId: null,
          }),
        },
      },
    });
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await service.cancelBooking('booking-1', 'client-1', 'changement de plan');

    expect(prisma.partnerProfile.update).not.toHaveBeenCalled();
  });

  it("refuse l'annulation une fois la mission IN_PROGRESS ou au-delà", async () => {
    const { prisma, pricing, payments, missions } = buildDeps({
      prisma: {
        booking: {
          findUnique: jest.fn().mockResolvedValue({ id: 'booking-1', clientId: 'client-1', status: BookingStatus.IN_PROGRESS }),
        },
      },
    });
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await expect(service.cancelBooking('booking-1', 'client-1', 'raison')).rejects.toThrow(ConflictException);
  });

  it("refuse l'annulation par un utilisateur qui n'est pas le client de la commande", async () => {
    const { prisma, pricing, payments, missions } = buildDeps({
      prisma: {
        booking: {
          findUnique: jest.fn().mockResolvedValue({ id: 'booking-1', clientId: 'client-1', status: BookingStatus.DRAFT }),
        },
      },
    });
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await expect(service.cancelBooking('booking-1', 'un-autre-client', 'raison')).rejects.toThrow(ForbiddenException);
  });

  it('lève NotFoundException si la commande à annuler est introuvable', async () => {
    const { prisma, pricing, payments, missions } = buildDeps({
      prisma: { booking: { findUnique: jest.fn().mockResolvedValue(null) } },
    });
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await expect(service.cancelBooking('booking-inconnu', 'client-1', 'raison')).rejects.toThrow(NotFoundException);
  });
});

// Incident dédié "non-paiement" — voir IncidentsService.report. Le délai de
// carence de 30 min protège contre un signalement précipité.
describe('BookingsService — cancelForNonPayment', () => {
  function buildBooking(overrides: Partial<Record<string, any>> = {}) {
    return {
      id: 'booking-1',
      status: BookingStatus.ARRIVED,
      assignedPartnerId: 'partner-1',
      assignedPartner: { userId: 'partner-user-1' },
      arrivedAt: new Date(Date.now() - 31 * 60_000), // arrivé il y a 31 min
      ...overrides,
    };
  }

  it('annule la commande et libère le partenaire une fois le délai de 30 min écoulé', async () => {
    const { prisma, pricing, payments, missions } = buildDeps({
      prisma: { booking: { findUnique: jest.fn().mockResolvedValue(buildBooking()) } },
    });
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await service.cancelForNonPayment('booking-1', 'partner-user-1');

    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: expect.objectContaining({ status: BookingStatus.CANCELLED }),
    });
    expect(prisma.partnerProfile.update).toHaveBeenCalledWith({
      where: { id: 'partner-1' },
      data: { isAvailable: true },
    });
  });

  it("refuse tant que le délai de 30 min après l'arrivée n'est pas écoulé", async () => {
    const { prisma, pricing, payments, missions } = buildDeps({
      prisma: {
        booking: {
          findUnique: jest
            .fn()
            .mockResolvedValue(buildBooking({ arrivedAt: new Date(Date.now() - 5 * 60_000) })),
        },
      },
    });
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await expect(service.cancelForNonPayment('booking-1', 'partner-user-1')).rejects.toThrow(ConflictException);
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it("refuse si le partenaire n'est pas celui assigné à la commande", async () => {
    const { prisma, pricing, payments, missions } = buildDeps({
      prisma: { booking: { findUnique: jest.fn().mockResolvedValue(buildBooking()) } },
    });
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await expect(service.cancelForNonPayment('booking-1', 'un-autre-partenaire')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("refuse si la commande n'est pas encore arrivée ou déjà payée (ex: PAID)", async () => {
    const { prisma, pricing, payments, missions } = buildDeps({
      prisma: {
        booking: { findUnique: jest.fn().mockResolvedValue(buildBooking({ status: BookingStatus.PAID })) },
      },
    });
    const service = new BookingsService(prisma as any, pricing as any, payments as any, missions as any);

    await expect(service.cancelForNonPayment('booking-1', 'partner-user-1')).rejects.toThrow(ConflictException);
  });
});
