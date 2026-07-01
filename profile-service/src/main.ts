import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  setupSwagger(app);
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
}

bootstrap();
