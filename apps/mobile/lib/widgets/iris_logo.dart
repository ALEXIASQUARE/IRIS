import 'package:flutter/material.dart';

// Logo IRIS Mobile — même fichier que l'icône de l'application (voir
// assets/icon/icon.jpg, régénérée via flutter_launcher_icons).
class IrisLogo extends StatelessWidget {
  final double size;

  const IrisLogo({super.key, this.size = 88});

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: scheme.primary.withValues(alpha: 0.35),
            blurRadius: size * 0.25,
            offset: Offset(0, size * 0.08),
          ),
        ],
      ),
      child: ClipOval(
        child: Image.asset(
          'assets/icon/icon.jpg',
          width: size,
          height: size,
          fit: BoxFit.cover,
        ),
      ),
    );
  }
}
