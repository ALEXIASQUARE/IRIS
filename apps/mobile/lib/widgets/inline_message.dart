import 'package:flutter/material.dart';
import '../theme.dart';

/// Message contextuel uniforme (erreur / succès / info) affiché dans le flux
/// d'un écran — remplace les `Text(..., style: rouge)` disséminés partout.
class InlineMessage extends StatelessWidget {
  const InlineMessage._(this.text, this._kind);

  const InlineMessage.error(String text, {Key? key}) : this._(text, _Kind.error);
  const InlineMessage.success(String text, {Key? key}) : this._(text, _Kind.success);
  const InlineMessage.info(String text, {Key? key}) : this._(text, _Kind.info);

  final String text;
  final _Kind _kind;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    final (Color fg, Color bg, IconData icon) = switch (_kind) {
      _Kind.error => (scheme.onErrorContainer, scheme.errorContainer, Icons.error_outline),
      _Kind.success => (
          IrisTheme.successColor(context),
          IrisTheme.successColor(context).withValues(alpha: 0.12),
          Icons.check_circle_outline,
        ),
      _Kind.info => (scheme.onSecondaryContainer, scheme.secondaryContainer, Icons.info_outline),
    };

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 20, color: fg),
          const SizedBox(width: 10),
          Expanded(
            child: Text(text, style: TextStyle(color: fg, height: 1.35)),
          ),
        ],
      ),
    );
  }
}

enum _Kind { error, success, info }
