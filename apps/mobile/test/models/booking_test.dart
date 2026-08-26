import 'package:flutter_test/flutter_test.dart';
import 'package:iris_mobile/models/booking.dart';

// Le backend sérialise les champs Decimal (Prisma) en chaînes JSON — ces
// tests vérifient que fromJson() gère ça correctement, et que la logique
// métier ajoutée côté mobile (révision de prix en attente, annulabilité)
// est correcte.

Map<String, dynamic> _bookingJson({
  String status = 'SEARCHING_PARTNER',
  List<Map<String, dynamic>>? priceRevisions,
  dynamic finalTotal,
}) =>
    {
      'id': 'booking-1',
      'status': status,
      'estimatedTotal': '1300.00', // Decimal Prisma -> chaîne, pas nombre.
      'finalTotal': finalTotal,
      'currency': 'XAF',
      'scheduledAt': '2026-08-25T10:00:00.000Z',
      'missionPin': null,
      'priceRevisions': priceRevisions ?? [],
    };

void main() {
  group('Booking.fromJson', () {
    test('parse un total Decimal sérialisé en chaîne', () {
      final booking = Booking.fromJson(_bookingJson());
      expect(booking.estimatedTotal, 1300.0);
    });

    test('displayTotal retombe sur estimatedTotal tant que finalTotal est absent', () {
      final booking = Booking.fromJson(_bookingJson());
      expect(booking.displayTotal, 1300.0);
    });

    test('displayTotal privilégie finalTotal une fois fixé', () {
      final booking = Booking.fromJson(_bookingJson(finalTotal: '1450.00'));
      expect(booking.displayTotal, 1450.0);
    });
  });

  group('Booking.isCancellable', () {
    for (final status in ['DRAFT', 'SEARCHING_PARTNER', 'PARTNER_ASSIGNED', 'PARTNER_EN_ROUTE']) {
      test('$status est annulable', () {
        expect(Booking.fromJson(_bookingJson(status: status)).isCancellable, isTrue);
      });
    }

    // PENDING_PAYMENT/PAID désignent désormais le paiement à l'arrivée
    // (après ARRIVED, lui-même non annulable) — exclus pour rester cohérent.
    for (final status in ['ARRIVED', 'PENDING_PAYMENT', 'PAID', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED']) {
      test('$status n\'est pas annulable', () {
        expect(Booking.fromJson(_bookingJson(status: status)).isCancellable, isFalse);
      });
    }
  });

  group('Booking.pendingPriceRevision', () {
    test("est null quand il n'y a aucune révision", () {
      expect(Booking.fromJson(_bookingJson()).pendingPriceRevision, isNull);
    });

    test('est null quand toutes les révisions sont déjà confirmées', () {
      final booking = Booking.fromJson(_bookingJson(priceRevisions: [
        {
          'id': 'rev-1',
          'previousTotal': '1300.00',
          'newTotal': '1500.00',
          'reason': 'Pièce supplémentaire',
          'confirmedByClientAt': '2026-08-25T10:05:00.000Z',
        },
      ]));

      expect(booking.pendingPriceRevision, isNull);
    });

    test('renvoie la révision non confirmée avec ses montants', () {
      final booking = Booking.fromJson(_bookingJson(status: 'PRICE_REVISION_PENDING', priceRevisions: [
        {
          'id': 'rev-2',
          'previousTotal': '1300.00',
          'newTotal': '1600.00',
          'reason': 'Tache supplémentaire constatée',
          'confirmedByClientAt': null,
        },
      ]));

      final pending = booking.pendingPriceRevision;
      expect(pending, isNotNull);
      expect(pending!.id, 'rev-2');
      expect(pending.previousTotal, 1300.0);
      expect(pending.newTotal, 1600.0);
      expect(pending.reason, 'Tache supplémentaire constatée');
    });
  });
}
