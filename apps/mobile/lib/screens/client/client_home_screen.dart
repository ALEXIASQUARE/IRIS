import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../auth/auth_state.dart';
import 'booking_status_screen.dart';
import 'client_profile_screen.dart';
import 'new_booking_screen.dart';

// Point d'entrée de l'espace client — bascule entre une nouvelle réservation
// et le suivi de la réservation en cours, même principe que ClientSpace.tsx
// (admin-web) : un seul `bookingId` en état local, pas de persistance ni de
// liste d'historique (le backend n'expose pas encore de "mes réservations").
class ClientHomeScreen extends StatefulWidget {
  const ClientHomeScreen({super.key});

  @override
  State<ClientHomeScreen> createState() => _ClientHomeScreenState();
}

class _ClientHomeScreenState extends State<ClientHomeScreen> {
  String? _bookingId;

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthState>();
    return Scaffold(
      appBar: AppBar(
        title: Text(_bookingId == null ? 'Nouvelle réservation' : 'Ma réservation'),
        actions: [
          IconButton(
            icon: const Icon(Icons.person_outline),
            tooltip: 'Mon profil',
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const ClientProfileScreen()),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Se déconnecter',
            onPressed: () {
              setState(() => _bookingId = null);
              auth.logout();
            },
          ),
        ],
      ),
      body: _bookingId == null
          ? NewBookingScreen(onBooked: (id) => setState(() => _bookingId = id))
          : BookingStatusScreen(
              bookingId: _bookingId!,
              onNewBooking: () => setState(() => _bookingId = null),
            ),
    );
  }
}
