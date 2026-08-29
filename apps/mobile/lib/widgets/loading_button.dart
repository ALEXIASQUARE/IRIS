import 'package:flutter/material.dart';

/// Bouton plein avec état occupé intégré — remplace le motif répété
/// `FilledButton(onPressed: busy ? null : fn, child: busy ? spinner : Text())`.
class LoadingFilledButton extends StatelessWidget {
  const LoadingFilledButton({
    super.key,
    required this.onPressed,
    required this.label,
    this.busy = false,
    this.icon,
    this.style,
  });

  final VoidCallback? onPressed;
  final String label;
  final bool busy;
  final IconData? icon;
  final ButtonStyle? style;

  @override
  Widget build(BuildContext context) {
    final child = busy
        ? const SizedBox(
            height: 20,
            width: 20,
            child: CircularProgressIndicator(strokeWidth: 2.4),
          )
        : Text(label);

    if (icon != null && !busy) {
      return FilledButton.icon(
        onPressed: busy ? null : onPressed,
        icon: Icon(icon),
        label: Text(label),
        style: style,
      );
    }

    return FilledButton(
      onPressed: busy ? null : onPressed,
      style: style,
      child: child,
    );
  }
}
