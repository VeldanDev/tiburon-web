// Pembersihan DOM otomatis antar-uji komponen.
//
// @testing-library/react versi terpasang (16.3.3) tidak punya sub-ekspor
// "/vitest" yang mendaftarkan afterEach(cleanup) otomatis. Tanpa ini, DOM
// dari satu it() bocor ke it() berikutnya dalam berkas yang sama, dan
// query seperti getByText() gagal dengan "multiple elements found" —
// kegagalan lingkungan, bukan kegagalan fitur.
//
// cleanup() aman dipanggil di berkas uji ber-environment "node": ia hanya
// menyentuh `document` di dalam forEach atas root yang pernah di-render,
// jadi pada berkas tanpa render() ini adalah operasi kosong.
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
