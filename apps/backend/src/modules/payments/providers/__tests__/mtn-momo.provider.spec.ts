import { MtnMomoProvider } from '../mtn-momo.provider';

// Adaptateur réel MTN MoMo (Collections API) — teste le flux complet
// (token OAuth2 -> requestToPay -> checkStatus) en mockant fetch, sans
// appeler le vrai sandbox MTN.

function buildConfig(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    MTN_MOMO_BASE_URL: 'https://sandbox.momodeveloper.mtn.com',
    MTN_MOMO_SUBSCRIPTION_KEY: 'sub-key',
    MTN_MOMO_API_USER: 'api-user',
    MTN_MOMO_API_KEY: 'api-key',
    MTN_MOMO_TARGET_ENVIRONMENT: 'sandbox',
    ...overrides,
  };
  return { get: jest.fn((key: string) => values[key]) };
}

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

describe('MtnMomoProvider — initiate', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renvoie PENDING_CONFIRMATION quand requestToPay est accepté (202)', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'tok-1' })) // token
      .mockResolvedValueOnce({ status: 202, ok: false, text: async () => '' } as Response); // requesttopay
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new MtnMomoProvider(buildConfig() as any);
    const result = await provider.initiate({
      bookingId: 'booking-1',
      amount: 1300,
      currency: 'XAF',
      phone: '+237600000001',
    });

    expect(result.status).toBe('PENDING_CONFIRMATION');
    expect(result.externalReference).toMatch(/^[0-9a-f-]{36}$/);

    // Vérifie que le numéro est envoyé sans le "+" (format MSISDN attendu par MTN).
    const requestToPayCall = fetchMock.mock.calls[1];
    const body = JSON.parse(requestToPayCall[1].body);
    expect(body.payer.partyId).toBe('237600000001');
  });

  it("renvoie FAILED quand requestToPay est rejeté par MTN", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'tok-1' }))
      .mockResolvedValueOnce({ status: 400, ok: false, text: async () => 'Invalid payer' } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new MtnMomoProvider(buildConfig() as any);
    const result = await provider.initiate({
      bookingId: 'booking-1',
      amount: 1300,
      currency: 'XAF',
      phone: '+237600000001',
    });

    expect(result.status).toBe('FAILED');
  });

  it("renvoie FAILED (au lieu de lever) quand l'obtention du token échoue", async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 } as Response) as unknown as typeof fetch;

    const provider = new MtnMomoProvider(buildConfig() as any);
    const result = await provider.initiate({
      bookingId: 'booking-1',
      amount: 1300,
      currency: 'XAF',
      phone: '+237600000001',
    });

    expect(result.status).toBe('FAILED');
  });
});

describe('MtnMomoProvider — checkStatus', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('mappe SUCCESSFUL vers SUCCESS', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'tok-1' }))
      .mockResolvedValueOnce(jsonResponse(200, { status: 'SUCCESSFUL' }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new MtnMomoProvider(buildConfig() as any);
    expect(await provider.checkStatus('ref-1')).toBe('SUCCESS');
  });

  it('mappe FAILED vers FAILED', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'tok-1' }))
      .mockResolvedValueOnce(jsonResponse(200, { status: 'FAILED' }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new MtnMomoProvider(buildConfig() as any);
    expect(await provider.checkStatus('ref-1')).toBe('FAILED');
  });

  it("mappe un statut encore en cours (PENDING) vers PENDING_CONFIRMATION", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { access_token: 'tok-1' }))
      .mockResolvedValueOnce(jsonResponse(200, { status: 'PENDING' }));
    global.fetch = fetchMock as unknown as typeof fetch;

    const provider = new MtnMomoProvider(buildConfig() as any);
    expect(await provider.checkStatus('ref-1')).toBe('PENDING_CONFIRMATION');
  });

  it('reste PENDING_CONFIRMATION (au lieu de lever) en cas de panne réseau', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const provider = new MtnMomoProvider(buildConfig() as any);
    await expect(provider.checkStatus('ref-1')).resolves.toBe('PENDING_CONFIRMATION');
  });
});
