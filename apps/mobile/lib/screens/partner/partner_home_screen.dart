import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../api/api_client.dart';
import '../../api/api_exception.dart';
import '../../auth/auth_state.dart';
import '../../countries/countries_repository.dart';
import '../../partners/partners_repository.dart';
import 'partner_mission_screen.dart';
import 'partner_offers_screen.dart';
import 'partner_profile_screen.dart';

// Point d'entrée de l'espace partenaire — même structure que PartnerSpace.tsx
// (admin-web) : création/mise à jour idempotente du profil au démarrage,
// bascule disponible/indisponible, puis liste d'offres ou mission active
// selon `_activeBookingId` (état local, pas de persistance).
//
// Contrairement à admin-web, on affiche aussi le statut d'agrément
// (PartnerProfile.status) : un profil PENDING_REVIEW ne reçoit jamais
// d'offre tant qu'un admin ne l'approuve pas (voir PartnersService côté
// backend), et l'app le signale explicitement plutôt que de laisser
// l'utilisateur devant une liste d'offres vide sans explication.
class PartnerHomeScreen extends StatefulWidget {
  const PartnerHomeScreen({super.key});

  @override
  State<PartnerHomeScreen> createState() => _PartnerHomeScreenState();
}

class _PartnerHomeScreenState extends State<PartnerHomeScreen> {
  late final PartnersRepository _partners;
  late final CountriesRepository _countries;

  bool _loading = true;
  String? _error;
  String? _zoneId;
  String? _zoneName;
  String? _profileStatus;
  bool _available = false;
  bool _togglingAvailability = false;
  String? _activeBookingId;

  bool get _isActive => _profileStatus == 'ACTIVE';

  @override
  void initState() {
    super.initState();
    final client = context.read<ApiClient>();
    _partners = PartnersRepository(client);
    _countries = CountriesRepository(client);
    _init();
  }

  Future<void> _init() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      // Même simplification que côté client : pas de sélecteur pays/zone,
      // on prend le premier pays qui a réellement des zones configurées
      // (voir CountriesRepository.findFirstCountryWithZones).
      final countryWithZones = await _countries.findFirstCountryWithZones();
      final zone = countryWithZones.zones.first;

      // Filet de sécurité idempotent — voir PartnerSetup.tsx : le profil
      // devrait déjà exister, cet appel couvre les comptes créés autrement.
      await _partners.upsertProfile(currentZoneId: zone.id).catchError((_) {});

      final profile = await _partners.getProfile();

      setState(() {
        _zoneId = zone.id;
        _zoneName = zone.name;
        _profileStatus = profile.status;
        _available = profile.isAvailable;
      });
    } catch (e) {
      setState(() => _error = e is ApiException ? e.message : e.toString());
    } finally {
      setState(() => _loading = false);
    }
  }

  Future<void> _toggleAvailability() async {
    if (_zoneId == null) return;
    final next = !_available;
    setState(() {
      _togglingAvailability = true;
      _error = null;
    });
    try {
      await _partners.setAvailability(isAvailable: next, currentZoneId: _zoneId);
      setState(() => _available = next);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _togglingAvailability = false);
    }
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'PENDING_REVIEW':
        return 'En attente d\'approbation par un administrateur';
      case 'REJECTED':
        return 'Candidature refusée';
      case 'SUSPENDED':
        return 'Compte suspendu';
      case 'DEACTIVATED':
        return 'Compte désactivé';
      case 'APPROVED':
        return 'Approuvé — activation en cours';
      default:
        return status;
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Espace partenaire'),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_outline),
            tooltip: 'Mon profil',
            onPressed: _loading
                ? null
                : () async {
                    await Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => PartnerProfileScreen(
                          currentZoneId: _zoneId,
                          onZoneChanged: (zone) {
                            setState(() {
                              _zoneId = zone.id;
                              _zoneName = zone.name;
                            });
                          },
                        ),
                      ),
                    );
                  },
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Se déconnecter',
            onPressed: () {
              setState(() => _activeBookingId = null);
              auth.logout();
            },
          ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.all(16),
                    child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                  ),
                if (!_isActive && _profileStatus != null)
                  Card(
                    margin: const EdgeInsets.all(16),
                    color: Theme.of(context).colorScheme.errorContainer,
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Row(
                        children: [
                          Icon(Icons.hourglass_top, color: Theme.of(context).colorScheme.onErrorContainer),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              _statusLabel(_profileStatus!),
                              style: TextStyle(color: Theme.of(context).colorScheme.onErrorContainer),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                Card(
                  margin: const EdgeInsets.all(16),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(
                            'Zone : ${_zoneName ?? '—'} — ${_available ? 'Disponible' : 'Indisponible'}',
                          ),
                        ),
                        FilledButton(
                          onPressed: (_togglingAvailability || _zoneId == null || !_isActive)
                              ? null
                              : _toggleAvailability,
                          style: _available
                              ? FilledButton.styleFrom(backgroundColor: Theme.of(context).colorScheme.error)
                              : null,
                          child: Text(_available ? 'Se retirer' : 'Se rendre disponible'),
                        ),
                      ],
                    ),
                  ),
                ),
                Expanded(
                  child: !_isActive
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(24),
                            child: Text(
                              'Vous recevrez des offres de mission une fois votre profil approuvé.',
                              textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                          ),
                        )
                      : _activeBookingId == null
                          ? PartnerOffersScreen(onAccepted: (id) => setState(() => _activeBookingId = id))
                          : PartnerMissionScreen(
                              bookingId: _activeBookingId!,
                              onDone: () => setState(() => _activeBookingId = null),
                            ),
                ),
              ],
            ),
    );
  }
}
