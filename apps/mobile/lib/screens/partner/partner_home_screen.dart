import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../api/api_client.dart';
import '../../api/api_exception.dart';
import '../../auth/auth_state.dart';
import '../../countries/countries_repository.dart';
import '../../models/partner_profile.dart';
import '../../models/zone.dart';
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
  String? _cityName;
  String? _countryName;
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
      PartnerProfile? profile;
      try {
        profile = await _partners.getProfile();
      } on ApiException catch (e) {
        if (e.statusCode != 404) rethrow;
      }

      // Filet de sécurité idempotent, uniquement si le profil n'existe pas
      // encore (comptes créés avant l'ajout du choix de zone à l'inscription
      // — voir RegisterScreen). Ne JAMAIS réaffecter la zone d'un profil
      // existant ici : elle a été choisie à l'inscription ou corrigée par le
      // partenaire dans PartnerProfileScreen, la réécraser à chaque
      // ouverture de l'app annulerait silencieusement ce choix. Même
      // simplification que côté client pour ce filet de sécurité
      // uniquement : pas de sélecteur pays/zone, on prend le premier pays
      // qui a réellement des zones configurées.
      if (profile == null) {
        final countryWithZones = await _countries.findFirstCountryWithZones();
        final zone = countryWithZones.zones.first;
        await _partners.upsertProfile(currentZoneId: zone.id);
        profile = await _partners.getProfile();
      }

      // Résout la zone du profil directement par son id (voir
      // CountriesRepository.getZone) plutôt que de la chercher dans la
      // liste des zones du pays "prêt" (findFirstCountryWithZones) : un
      // partenaire peut être enregistré dans un pays de test sans
      // catalogue de services (Belgique, France), auquel cas sa zone
      // n'apparaît jamais dans cette liste. La chercher là-dedans faisait
      // silencieusement retomber l'affichage sur la première zone du pays
      // prêt ("Abang" pour le Cameroun) — et cette valeur erronée était
      // ensuite réécrite en base dès que le partenaire touchait au bouton
      // disponible/indisponible (setAvailability envoie _zoneId).
      Zone? zone;
      final currentZoneId = profile.currentZoneId;
      if (currentZoneId != null) {
        try {
          zone = await _countries.getZone(currentZoneId);
        } catch (_) {
          // zone introuvable (supprimée, désactivée...) — pas de zone affichable
        }
      }

      setState(() {
        _zoneId = zone?.id;
        _zoneName = zone?.name;
        _cityName = zone?.cityName;
        _countryName = zone?.countryName;
        _profileStatus = profile!.status;
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
                              _cityName = zone.cityName;
                              _countryName = zone.countryName;
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
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text('Pays : ${_countryName ?? '—'}'),
                              Text('Ville : ${_cityName ?? '—'}'),
                              Text('Quartier : ${_zoneName ?? '—'}'),
                              const SizedBox(height: 4),
                              Text(
                                _available ? 'Disponible' : 'Indisponible',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: _available
                                      ? Theme.of(context).colorScheme.primary
                                      : Theme.of(context).colorScheme.error,
                                ),
                              ),
                            ],
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
