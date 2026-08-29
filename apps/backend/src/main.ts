import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Fichiers publics servis à la racine (hors /api/v1) : version.json et
  // latest.apk, pour la vérification de mise à jour côté app mobile — voir
  // apps/mobile/lib/update/update_checker.dart. Mis à jour manuellement à
  // chaque nouvelle version : remplacer public/latest.apk et incrémenter
  // versionCode dans public/version.json (doit correspondre au build
  // number de pubspec.yaml), puis redéployer.
  app.useStaticAssets(join(__dirname, '..', '..', 'public'));

  // API versionnée — §11 du Cahier des charges : "utiliser une API
  // versionnée, par exemple /api/v1/".
  app.setGlobalPrefix('api/v1');

  // Validation serveur de toutes les entrées — §13.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS : ouvert par défaut (dev). En production, définir CORS_ORIGINS =
  // liste d'origines séparées par des virgules (le site vitrine + l'espace
  // client web) pour restreindre — §13.
  const corsOrigins = process.env.CORS_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors(corsOrigins && corsOrigins.length > 0 ? { origin: corsOrigins } : {});

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  await app.listen(port);
  Logger.log(`IRIS API démarrée sur http://localhost:${port}/api/v1`, 'Bootstrap');
}

bootstrap();
