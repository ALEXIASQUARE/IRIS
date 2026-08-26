import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../api/api_client.dart';
import '../../api/api_exception.dart';
import '../../incidents/incidents_repository.dart';
import '../../models/incident.dart';

const _typeLabels = {
  'OBJET_ENDOMMAGE': 'Objet endommagé',
  'RETARD': 'Retard',
  'COMPORTEMENT': 'Comportement',
  'PAIEMENT_NON_EFFECTUE': 'Paiement non effectué',
  'AUTRE': 'Autre',
};

const _severityLabels = {
  'LOW': 'Faible',
  'MEDIUM': 'Moyenne',
  'HIGH': 'Élevée',
  'CRITICAL': 'Critique',
};

// Même comportement que IncidentReportForm.tsx (admin-web) : bouton replié
// par défaut, formulaire à la demande, utilisé aussi bien côté client que
// partenaire (aucune restriction de rôle sur POST /incidents).
class IncidentReportForm extends StatefulWidget {
  final String? bookingId;

  const IncidentReportForm({super.key, this.bookingId});

  @override
  State<IncidentReportForm> createState() => _IncidentReportFormState();
}

class _IncidentReportFormState extends State<IncidentReportForm> {
  late final IncidentsRepository _incidents;
  bool _open = false;
  bool _sent = false;
  bool _submitting = false;
  String? _error;

  String _type = incidentTypeCodes.first;
  String _severity = 'MEDIUM';
  final _descriptionController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _incidents = IncidentsRepository(context.read<ApiClient>());
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_descriptionController.text.trim().isEmpty) {
      setState(() => _error = 'Décrivez le problème.');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await _incidents.report(
        bookingId: widget.bookingId,
        type: _type,
        severity: _severity,
        description: _descriptionController.text.trim(),
      );
      setState(() => _sent = true);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_open) {
      return Padding(
        padding: const EdgeInsets.only(top: 8),
        child: OutlinedButton.icon(
          onPressed: () => setState(() => _open = true),
          icon: const Icon(Icons.report_problem_outlined),
          label: const Text('Signaler un incident'),
        ),
      );
    }

    if (_sent) {
      return const Padding(
        padding: EdgeInsets.only(top: 8),
        child: Text('Incident signalé, merci.'),
      );
    }

    return Card(
      margin: const EdgeInsets.only(top: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Signaler un incident', style: Theme.of(context).textTheme.titleMedium),
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              initialValue: _type,
              decoration: const InputDecoration(labelText: 'Type'),
              items: incidentTypeCodes
                  .map((c) => DropdownMenuItem(value: c, child: Text(_typeLabels[c] ?? c)))
                  .toList(),
              onChanged: (v) => setState(() => _type = v ?? incidentTypeCodes.first),
            ),
            if (_type == 'PAIEMENT_NON_EFFECTUE') ...[
              const SizedBox(height: 4),
              Text(
                "Signaler ceci annule immédiatement la mission et vous rend disponible pour d'autres commandes. Possible seulement 30 min après votre arrivée.",
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
            DropdownButtonFormField<String>(
              initialValue: _severity,
              decoration: const InputDecoration(labelText: 'Gravité'),
              items: incidentSeverities
                  .map((s) => DropdownMenuItem(value: s, child: Text(_severityLabels[s] ?? s)))
                  .toList(),
              onChanged: (v) => setState(() => _severity = v ?? 'MEDIUM'),
            ),
            TextField(
              controller: _descriptionController,
              decoration: const InputDecoration(labelText: 'Description'),
              maxLines: 3,
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: FilledButton(
                    onPressed: _submitting ? null : _submit,
                    child: _submitting
                        ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2))
                        : const Text('Envoyer'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => setState(() => _open = false),
                    child: const Text('Annuler'),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
