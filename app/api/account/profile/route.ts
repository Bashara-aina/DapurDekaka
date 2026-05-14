import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { success, unauthorized, serverError, validationError } from '@/lib/utils/api-response';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return unauthorized('Silakan masuk terlebih dahulu');
    }

    const user = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.id, session.user.id!),
      columns: {
        id: true,
        name: true,
        email: true,
        phone: true,
        languagePreference: true,
      },
    });

    if (!user) {
      return unauthorized('Silakan masuk terlebih dahulu');
    }

    return success(user);
  } catch (error) {
    console.error('[account/profile GET]', error);
    return serverError(error);
  }
}

const UpdateProfileSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter').max(255).optional(),
  phone: z.string().min(5, 'Nomor telepon tidak valid').max(20).optional().nullable(),
  languagePreference: z.enum(['id', 'en']).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return unauthorized('Silakan masuk terlebih dahulu');
    }

    const body = await req.json();
    const parsed = UpdateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const [updated] = await db
      .update(users)
      .set({
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.phone !== undefined && { phone: parsed.data.phone }),
        ...(parsed.data.languagePreference !== undefined && { languagePreference: parsed.data.languagePreference }),
        updatedAt: new Date(),
      })
      .where(eq(users.id, session.user.id))
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        phone: users.phone,
        languagePreference: users.languagePreference,
      });

    return success(updated);
  } catch (error) {
    console.error('[account/profile PATCH]', error);
    return serverError(error);
  }
}