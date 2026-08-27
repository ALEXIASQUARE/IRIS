import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'update_info.dart';

Future<void> showUpdateDialog(BuildContext context, UpdateInfo update) {
  return showDialog<void>(
    context: context,
    barrierDismissible: true,
    builder: (context) => AlertDialog(
      title: const Text('Nouvelle version disponible'),
      content: Text(
        'La version ${update.version} d\'IRIS est disponible.'
        '${update.notes != null && update.notes!.isNotEmpty ? '\n\n${update.notes}' : ''}'
        '\n\nElle va s\'ouvrir dans votre navigateur pour téléchargement — installez-la ensuite comme la première fois.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Plus tard'),
        ),
        FilledButton(
          onPressed: () async {
            Navigator.of(context).pop();
            await launchUrl(Uri.parse(update.apkUrl), mode: LaunchMode.externalApplication);
          },
          child: const Text('Télécharger'),
        ),
      ],
    ),
  );
}
