import type { Metadata } from "next";
import { SKRIP_TEMA } from "@/components/PemilihTema";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tiburon",
  description:
    "Hiu pembelajar milik Veldan — menjawab dari korpusmu sendiri, dan menyebut sumbernya.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/*
          Tema disetel SEBELUM cat pertama.

          suppressHydrationWarning di <html> ada khusus untuk ini, dan bukan
          cara menutupi bug: skrip di bawah memang MENGUBAH atribut <html>
          sebelum React sempat menghidrasi, jadi markup server dan klien
          memang berbeda di situ — dan itu justru yang diinginkan. Tanpa
          skripnya, pengguna tema terang melihat kedipan hitam di setiap
          pemuatan halaman, karena server tidak bisa tahu isi localStorage.

          Peringatannya ditekan hanya di elemen ini, bukan di seluruh pohon.
        */}
        <script dangerouslySetInnerHTML={{ __html: SKRIP_TEMA }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
