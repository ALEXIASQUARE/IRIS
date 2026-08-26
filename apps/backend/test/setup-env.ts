// Base de données dédiée aux tests E2E, distincte de la base de dev/démo.
// À créer/migrer une fois : DATABASE_URL="mysql://iris:iris_dev_password@localhost:3306/iris_test" npx prisma migrate deploy
process.env.DATABASE_URL = 'mysql://iris:iris_dev_password@localhost:3306/iris_test';
