"use server";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, locales } from "@/i18n/config";

export async function setLocale(locale: string) {
  if (!(locales as readonly string[]).includes(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
}
