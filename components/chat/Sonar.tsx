"use client";

/**
 * Denyut sonar.
 *
 * Muncul satu kali, tepat saat Tiburon mulai mencari korpus — cincin yang
 * mengembang lalu memudar, seperti pantulan sonar di kegelapan.
 *
 * Kenapa ini pantas dianimasikan: ia dipicu pengguna, terjadi sesekali (bukan
 * puluhan kali sehari), dan tujuannya jelas — memberi tahu bahwa PENCARIAN
 * KORPUS sedang berjalan, bukan sekadar model sedang berpikir. Itu pembeda
 * Tiburon dari chatbot lain, dan sekarang punya bunyinya sendiri secara visual.
 *
 * Jalur Cepat tidak menyentuh korpus, jadi tidak pernah memancarkan denyut ini.
 * Ketiadaannya membawa informasi sama banyaknya dengan kehadirannya.
 */

export function Sonar({ aktif }: { aktif: boolean }) {
  if (!aktif) return null;

  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
      {[0, 1].map((i) => (
        <span
          key={i}
          className="sonar-cincin absolute rounded-full"
          style={{
            width: 18,
            height: 18,
            border: "1px solid var(--surface)",
            animationDelay: `${i * 520}ms`,
          }}
        />
      ))}
    </span>
  );
}
