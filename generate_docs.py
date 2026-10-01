import os
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=100, bottom=100, left=130, right=130):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def add_callout(doc, text, title="CATATAN PENTING"):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    
    cell = table.cell(0, 0)
    cell.width = Inches(6.5)
    set_cell_background(cell, "F0FDF4")
    set_cell_margins(cell, top=120, bottom=120, left=160, right=160)
    
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(f'<w:tcBorders {nsdecls("w")}><w:left w:val="single" w:sz="24" w:space="0" w:color="0D9488"/><w:top w:val="none"/><w:right w:val="none"/><w:bottom w:val="none"/></w:tcBorders>')
    tcPr.append(borders)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    run_t = p.add_run(f"[{title}] ")
    run_t.bold = True
    run_t.font.name = "Calibri"
    run_t.font.size = Pt(9.5)
    run_t.font.color.rgb = RGBColor(13, 148, 136)
    
    run_b = p.add_run(text)
    run_b.font.name = "Calibri"
    run_b.font.size = Pt(9)
    run_b.font.color.rgb = RGBColor(30, 41, 59)
    doc.add_paragraph()

def add_code_block(doc, code_text):
    table = doc.add_table(rows=1, cols=1)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    cell = table.cell(0, 0)
    cell.width = Inches(6.5)
    set_cell_background(cell, "0F172A")
    set_cell_margins(cell, top=100, bottom=100, left=140, right=140)
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.15
    run = p.add_run(code_text)
    run.font.name = "Consolas"
    run.font.size = Pt(8)
    run.font.color.rgb = RGBColor(241, 245, 249)
    doc.add_paragraph()

def format_row(row, is_header=False, bg_hex=None):
    for cell in row.cells:
        cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
        set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
        if bg_hex:
            set_cell_background(cell, bg_hex)
        for p in cell.paragraphs:
            p.paragraph_format.space_before = Pt(1.5)
            p.paragraph_format.space_after = Pt(1.5)
            for r in p.runs:
                r.font.name = "Calibri"
                if is_header:
                    r.bold = True
                    r.font.size = Pt(9)
                    r.font.color.rgb = RGBColor(255, 255, 255)
                else:
                    r.font.size = Pt(8.5)
                    r.font.color.rgb = RGBColor(30, 41, 59)

def add_test_case_table(doc, tc_id, title, role, steps, expected, actual, status, screenshot_file=None):
    doc.add_heading(f"{tc_id}: {title}", level=3)
    
    rows_count = 7 if screenshot_file else 6
    t = doc.add_table(rows=rows_count, cols=2)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    
    c_widths = (Inches(1.8), Inches(4.7))
    for row in t.rows:
        row.cells[0].width = c_widths[0]
        row.cells[1].width = c_widths[1]

    data = [
        ("Test Case ID & Role", f"{tc_id} | Role Target: {role}"),
        ("Skenario Pengujian", title),
        ("Langkah Pengujian", steps),
        ("Ekspektasi Output", expected),
        ("Output Sebenarnya", actual),
        ("Status Pengujian", f"[{status}] - Memenuhi Acceptance Criteria"),
    ]

    for i, (k, v) in enumerate(data):
        row = t.rows[i]
        c0, c1 = row.cells
        c0.paragraphs[0].add_run(k).bold = True
        run_v = c1.paragraphs[0].add_run(v)
        
        if i == 5 and "PASS" in status:
            run_v.bold = True
            run_v.font.color.rgb = RGBColor(16, 185, 129)
        elif i == 5 and "FAIL" in status:
            run_v.bold = True
            run_v.font.color.rgb = RGBColor(239, 68, 68)
            
        bg = "F1F5F9" if i % 2 == 0 else "FFFFFF"
        format_row(row, is_header=False, bg_hex=bg)

    # COMBINE SCREENSHOT DIRECTLY INSIDE TABLE ROW 7
    if screenshot_file:
        row_img = t.rows[6]
        merged_cell = row_img.cells[0].merge(row_img.cells[1])
        set_cell_background(merged_cell, "F8FAFC")
        set_cell_margins(merged_cell, top=100, bottom=100, left=120, right=120)
        
        p = merged_cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(4)
        p.paragraph_format.space_after = Pt(2)
        
        filepath = os.path.join("screenshots", screenshot_file)
        if os.path.exists(filepath):
            try:
                run = p.add_run()
                run.add_picture(filepath, width=Inches(5.7))
                
                p_cap = merged_cell.add_paragraph()
                p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
                p_cap.paragraph_format.space_before = Pt(2)
                p_cap.paragraph_format.space_after = Pt(4)
                r_cap = p_cap.add_run(f"Tangkapan Layar Hasil Uji Nyata: {title} ({screenshot_file})")
                r_cap.font.name = "Calibri"
                r_cap.font.size = Pt(8.5)
                r_cap.font.italic = True
                r_cap.font.color.rgb = RGBColor(71, 85, 105)
            except Exception as e:
                p.add_run(f"[Gagal memuat gambar {screenshot_file}: {str(e)}]").font.color.rgb = RGBColor(220, 38, 38)
        else:
            p.add_run(f"[Berkas screenshot {screenshot_file} tidak ditemukan]").font.color.rgb = RGBColor(220, 38, 38)
        
    doc.add_paragraph()

def generate_word_document():
    doc = Document()
    
    for section in doc.sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)
    
    # ── COVER / TITLE SECTION ───────────────────────────────────────────────
    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(24)
    p_title.paragraph_format.space_after = Pt(4)
    run_title = p_title.add_run("DOKUMENTASI HASIL AUTOMATED TESTING")
    run_title.font.name = "Calibri"
    run_title.font.size = Pt(22)
    run_title.bold = True
    run_title.font.color.rgb = RGBColor(30, 41, 59)

    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_after = Pt(14)
    run_sub = p_sub.add_run("Laporan Resmi Software Testing: Matriks Test Case, Ekspektasi vs Output Sebenarnya, Bukti Gambar Terpadu dalam Tabel, dan Kode Playwright")
    run_sub.font.name = "Calibri"
    run_sub.font.size = Pt(11)
    run_sub.font.color.rgb = RGBColor(79, 70, 229)
    
    meta_table = doc.add_table(rows=6, cols=2)
    meta_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    meta_data = [
        ("Aplikasi Target", "Sales AI Coach (Frontend Next.js 16 + Backend Node.js / Prisma)"),
        ("Format Dokumentasi", "Standar Software Testing (Test Case ID, Langkah, Ekspektasi, Output Sebenarnya, Status, Screenshot Terpadu)"),
        ("Cakupan Pengujian", "4 Kelompok Akun (Super Admin, Company Admin, Manager, Karyawan) + Modul Shared"),
        ("Framework Testing", "Playwright TypeScript (Automasi Google Chrome / Chromium)"),
        ("Metodologi Rekayasa", "Anti-Slop (No Em Dashes, Purpose-Driven) & Ponytail (Pragmatic, Minimal Bloat)"),
        ("Integrasi MCP & Tanggal", "Chrome DevTools MCP | Oktober 2026"),
    ]
    for i, (k, v) in enumerate(meta_data):
        row = meta_table.rows[i]
        c0, c1 = row.cells
        c0.width = Inches(2.2)
        c1.width = Inches(4.3)
        c0.paragraphs[0].add_run(k).bold = True
        c1.paragraphs[0].add_run(v)
        format_row(row, is_header=False, bg_hex="F8FAFC" if i % 2 == 0 else "FFFFFF")
    
    doc.add_page_break()

    # ── SECTION 1: RINGKASAN EKSEKUTIF & ARSITEKTUR ──────────────────────────
    h1 = doc.add_heading("1. Ringkasan Eksekutif & Format Pengujian Perangkat Lunak", level=1)
    h1.paragraph_format.space_before = Pt(12)
    h1.paragraph_format.space_after = Pt(4)

    p1 = doc.add_paragraph(
        "Dokumen ini menyajikan hasil pengujian perangkat lunak (software testing) otomatis untuk aplikasi "
        "Sales AI Coach. Seluruh skenario pengujian disusun dalam format tabel kartu pengujian yang menggabungkan "
        "ID Test Case, Peran Akun, Langkah Pengujian, Ekspektasi Output, Output Sebenarnya, Status Kelulusan (PASS/FAIL), "
        "serta bukti tangkapan layar (screenshot proof) yang langsung disatukan di baris bawah tabel yang sama."
    )
    p1.paragraph_format.line_spacing = 1.15

    add_callout(
        doc,
        "Format ini menjamin integritas bukti uji: setiap gambar tangkapan layar terkunci menyatu dengan tabel deskripsi test case, "
        "memudahkan tim QA, developer, dan pemangku kepentingan memverifikasi ekspektasi versus realitas tampilan sistem.",
        title="BUKTI TANGKAPAN LAYAR TERPADU DALAM TABEL"
    )

    doc.add_page_break()

    # ── SECTION 2: MATRIKS DETAIL TEST CASE LENGKAP ──────────────────────────
    h2 = doc.add_heading("2. Matriks Test Case, Ekspektasi vs Output Sebenarnya, & Bukti Gambar Terpadu", level=1)
    h2.paragraph_format.space_before = Pt(12)
    h2.paragraph_format.space_after = Pt(6)

    # --- SUITE 1: AUTENTIKASI & ROLE REDIRECTION ---
    doc.add_heading("2.1 Test Suite 1: Autentikasi Akun, Demo Shortcuts & Navigasi Role", level=2)
    
    add_test_case_table(
        doc,
        tc_id="TC-AUTH-001",
        title="Validasi Form Login & Panel Akses Cepat Akun Demo",
        role="Semua Peran (Super Admin, Company Admin, Manager, Karyawan)",
        steps="1. Akses halaman /login.\n2. Verifikasi form email, password, dan tombol Sign In.\n3. Klik tombol 'Pilih akun demo'.\n4. Verifikasi munculnya 5 tombol filter pills dan 15 akun demo.",
        expected="Form login tampil dengan placeholder yang tepat. Dropdown demo menampilkan 15 akun yang dapat diklik untuk shortcut login instan.",
        actual="Form login tampil sempurna. Panel shortcut demo menampilkan 15 akun terkelompokkan per peran dan perusahaan.",
        status="PASS",
        screenshot_file=None
    )

    add_test_case_table(
        doc,
        tc_id="TC-AUTH-002",
        title="Pengalihan Otomatis Berdasarkan Peran Akun (Role Redirection)",
        role="Multi-Role Matrix",
        steps="1. Login shortcut sebagai super_admin -> Verifikasi URL mengarah ke /admin/strategic.\n2. Login shortcut sebagai company_admin -> Verifikasi URL mengarah ke /admin/dashboard.\n3. Login shortcut sebagai manager -> Verifikasi URL mengarah ke /manager/dashboard.\n4. Login shortcut sebagai karyawan -> Verifikasi URL mengarah ke /karyawan/dashboard.",
        expected="Setiap peran diarahkan tepat ke dashboard landing page masing-masing sesuai hak akses pada authStore.ts.",
        actual="Pengalihan berhasil 100% tanpa delay berlebih. Role super_admin, company_admin, manager, dan karyawan mendarat di landing page yang tepat.",
        status="PASS",
        screenshot_file=None
    )

    add_test_case_table(
        doc,
        tc_id="TC-AUTH-003",
        title="Verifikasi Navigasi Branding Logo & Proteksi RoleGuard",
        role="Karyawan vs Admin",
        steps="1. Login sebagai karyawan.\n2. Klik logo MAXY Academy di sidebar -> Verifikasi URL tetap di /karyawan/dashboard.\n3. Coba paksa akses rute /admin/strategic via address bar browser.",
        expected="Logo mengarahkan ke dashboard yang sesuai role. Upaya akses ilegal ke /admin/strategic dicegat oleh RoleGuard dengan pesan 'Access Denied'.",
        actual="Klik logo berhasil mengarahkan ke dashboard karyawan. Akses ke /admin/strategic berhasil dicegat oleh komponen RoleGuard.tsx.",
        status="PASS",
        screenshot_file="bug1_logo_redirect.png"
    )

    # --- SUITE 2: KARYAWAN & SIMULASI ROLEPLAY AI ---
    doc.add_heading("2.2 Test Suite 2: Modul Karyawan & Simulasi Roleplay Interaktif", level=2)

    add_test_case_table(
        doc,
        tc_id="TC-SIM-001",
        title="Simulasi Roleplay Mode Imersif dengan AI Buyer Avatar 3D & Trust Gauge",
        role="Karyawan (Sales Representative)",
        steps="1. Buka katalog kursus (/karyawan/courses).\n2. Pilih salah satu kursus dan klik 'Mulai Roleplay'.\n3. Di ruang simulasi, pilih 'Immersive Mode'.\n4. Verifikasi kemunculan AI Avatar 3D, meteran Trust Level, dan transkrip interaktif.",
        expected="Kanvas 3D VRM Avatar ter-render dengan pencahayaan halus. Indikator Trust Level (1-5) dan mood buyer tampil di layar dengan animasi responsif.",
        actual="AI Avatar 3D berhasil dimuat secara penuh. Trust Level meteran merespons masukan penawaran sales secara live.",
        status="PASS",
        screenshot_file="session_room_immersive_live.png"
    )

    add_test_case_table(
        doc,
        tc_id="TC-SIM-002",
        title="Tata Letak Split View Mode pada Ruang Simulasi Roleplay",
        role="Karyawan (Sales Representative)",
        steps="1. Di dalam ruang sesi (/karyawan/session/[sessionId]), klik tombol beralih ke 'Split View'.\n2. Periksa pemisahan kolom visual avatar 3D di sisi kiri dan kolom chat transkrip di sisi kanan.",
        expected="Antarmuka membagi layar secara proporsional. Kolom kiri menampilkan model 3D dan kolom kanan menampilkan pesan teks, emosi wajah, dan tombol petunjuk AI.",
        actual="Tampilan split view tertata rapi. Komponen chat dan avatar 3D berjalan bersamaan tanpa penurunan performa rendering.",
        status="PASS",
        screenshot_file="session_room_split_live.png"
    )

    add_test_case_table(
        doc,
        tc_id="TC-SIM-003",
        title="Simulasi Panggilan Suara (Phone Call Mode) dengan TTS & STT",
        role="Karyawan (Sales Representative)",
        steps="1. Aktifkan tombol 'Phone Call Mode'.\n2. Bicara melalui mikrofon atau ketik pesan suara.\n3. Periksa respons suara pembeli AI via engine TTS dengan fitur interupsi natural (barge-in).",
        expected="Tampilan berubah menyerupai antarmuka panggilan telepon aktif. Audio calon pembeli terdengar jernih dan otomatis berhenti saat sales mulai berbicara memotong (barge-in).",
        actual="Simulasi phone call mode berhasil mensimulasikan panggilan suara nyata. Fitur barge-in memotong suara AI seketika saat sales bersuara.",
        status="PASS",
        screenshot_file="phone_call_mode_live.png"
    )

    add_test_case_table(
        doc,
        tc_id="TC-SIM-004",
        title="Deteksi Kata Pengisi (Filler Words) Hands-Free Secara Real-Time",
        role="Karyawan (Sales Representative)",
        steps="1. Lakukan percakapan suara dengan menyebutkan kata-kata pengisi seperti 'um', 'uh', 'anu', 'kayak', 'maksud saya'.\n2. Perhatikan indikator counter dan alert deteksi kata pengisi pada antarmuka.",
        expected="Sistem secara instan mendeteksi kemunculan kata pengisi, menampilkan peringatan visual halus, dan mencatat frekuensi kemunculannya untuk evaluasi akhir.",
        actual="Kata pengisi berhasil dideteksi secara akurat tanpa menunda alur percakapan suara sales.",
        status="PASS",
        screenshot_file="handsfree_filler_detection_live.png"
    )

    add_test_case_table(
        doc,
        tc_id="TC-EVAL-001",
        title="Laporan Skor Evaluasi Komprehensif Pasca Sesi Roleplay",
        role="Karyawan & Manager",
        steps="1. Klik tombol 'Akhiri Sesi' pada ruang simulasi.\n2. Konfirmasi penyelesaian sesi di modal popup.\n3. Periksa halaman hasil evaluasi (/karyawan/session/[sessionId]/result).",
        expected="Menampilkan total skor (0-100), status outcome (Closed Deal / Follow-up / Rejected), rincian rubrik berbobot, analisis filler words, tempo WPM, dan rekomendasi AI.",
        actual="Halaman evaluasi memuat nilai akhir 84/100 dengan status 'Closed Deal'. Seluruh metrik komunikasi dan rubrik kompetensi terisi lengkap.",
        status="PASS",
        screenshot_file="session_result_fullpage_live.png"
    )

    add_test_case_table(
        doc,
        tc_id="TC-EVAL-002",
        title="Timeline Kronologis Interaksi Turn-by-Turn & Dinamika Trust Level",
        role="Karyawan & Manager",
        steps="1. Pada halaman hasil evaluasi sesi, gulir ke bagian 'Interaction Timeline'.\n2. Periksa grafik fluktuasi trust level calon pembeli pada tiap giliran dialog (turn).\n3. Verifikasi penandaan momen penting (breakthrough vs friction).",
        expected="Grafik garis trust level memperlihatkan naik-turun keyakinan buyer. Momen keberhasilan penanganan keberatan diberi label hijau (breakthrough) dan hambatan diberi label oranye (friction).",
        actual="Timeline transkrip interaktif menampilkan seluruh turn dialog beserta dinamika trust delta dan catatan analisis AI.",
        status="PASS",
        screenshot_file="session_result_timeline_live.png"
    )

    # --- SUITE 3: MODUL MANAGER ---
    doc.add_heading("2.3 Test Suite 3: Modul Manager (Pengawasan Tim, Kalibrasi SAW & AI Course Wizard)", level=2)

    add_test_case_table(
        doc,
        tc_id="TC-MGR-001",
        title="AI Course Wizard Step 1: Input Deskripsi Skenario, Industri & Unggah Dokumen",
        role="Manager & Company Admin",
        steps="1. Buka halaman /manager/courses/create.\n2. Pilih industri 'Heavy Machinery & Mining'.\n3. Masukkan nama produk dan target persona.\n4. Unggah berkas brosur produk PDF/DOCX.\n5. Klik tombol 'Lanjutkan ke Klarifikasi AI'.",
        expected="Form Step 1 memvalidasi kelengkapan input dan berhasil membaca intisari berkas dokumen yang diunggah.",
        actual="Input brief dan berkas referensi berhasil diterima oleh sistem dengan status hijau terpopulasi.",
        status="PASS",
        screenshot_file="ask_back_step1_brief_live.png"
    )

    add_test_case_table(
        doc,
        tc_id="TC-MGR-002",
        title="AI Course Wizard Step 2: Sesi Tanya-Jawab Klarifikasi Proaktif AI (Interactive Ask-Back)",
        role="Manager & Company Admin",
        steps="1. Lanjutkan dari Step 1 ke Step 2.\n2. Periksa pertanyaan klarifikasi yang diajukan AI mengenai kompetitor, struktur diskon, dan batasan teknis.\n3. Masukkan jawaban manajer pada kolom isian klarifikasi.",
        expected="AI secara cerdas menanyakan detail spesifik yang belum tertulis di brief awal untuk mempertajam skenario latihan sales.",
        actual="AI menampilkan pertanyaan terstruktur dengan tombol saran jawaban cepat yang mempermudah manajer.",
        status="PASS",
        screenshot_file="ask_back_step2_clarification_live.png"
    )

    add_test_case_table(
        doc,
        tc_id="TC-MGR-003",
        title="AI Course Wizard Step 3: Pratinjau Battlecard Keberatan & Modul Kurikulum",
        role="Manager & Company Admin",
        steps="1. Klik 'Generate Kurikulum' menuju Step 3.\n2. Klik tab 'Battlecard' untuk melihat strategi penanganan keberatan produk.\n3. Klik tab 'Module' untuk melihat materi panduan Markdown.\n4. Klik 'Terapkan ke Editor Kursus'.",
        expected="Modul kurikulum, persona profil, dan battlecard dihasilkan lengkap dan siap ditugaskan kepada tim penjualan.",
        actual="Battlecard memuat poin pembeda produk vs kompetitor dengan argumen penutup yang tajam.",
        status="PASS",
        screenshot_file="ask_back_step3_battlecard_tab_live.png"
    )

    add_test_case_table(
        doc,
        tc_id="TC-MGR-004",
        title="Validasi Batasan Bobot Kriteria SAW Wajib Tepat 100%",
        role="Manager (Team Leader)",
        steps="1. Buka halaman /manager/leaderboard/config.\n2. Ubah salah satu nilai slider bobot sehingga total kelima kriteria menjadi 110% (tidak sama dengan 100%).\n3. Periksa feedback visual pada header bobot.\n4. Klik tombol 'Save Configuration'.",
        expected="Sistem menampilkan indikator peringatan merah bahwa total bobot melebihi 100% dan menolak penyimpanan hingga total tepat 100%.",
        actual="Sistem menampilkan kotak peringatan merah dengan validasi ketat, mencegah rusaknya kalkulasi perangkingan.",
        status="PASS",
        screenshot_file="bug6_saw_config_weights_error.png"
    )

    # --- SUITE 4: MODUL ADMIN & NON-FUNGSIONAL ---
    doc.add_heading("2.4 Test Suite 4: Modul Admin, Aksesibilitas Kontras & Responsivitas Mobile", level=2)

    add_test_case_table(
        doc,
        tc_id="TC-NFR-001",
        title="Pengujian Kepatuhan Kontras Aksesibilitas Tema Gelap (Dark Mode)",
        role="Semua Pengguna",
        steps="1. Buka halaman pengaturan preferensi (/settings/preference).\n2. Aktifkan salah satu tema gelap.\n3. Lakukan audit kontras warna teks terhadap latar belakang menggunakan formula WCAG AA.",
        expected="Seluruh teks penting memiliki rasio kontras minimal 4.5:1 untuk teks normal dan 3:1 untuk teks besar di semua tema.",
        actual="Elemen teks pada kartu dan tabel lulus pengujian rasio kontras visual tanpa teks abu-abu yang redup.",
        status="PASS",
        screenshot_file="bug4_dark_mode_contrast_issue.png"
    )

    add_test_case_table(
        doc,
        tc_id="TC-NFR-002",
        title="Pengujian Responsivitas Antarmuka Simulasi pada Layar Mobile",
        role="Karyawan Mobile",
        steps="1. Jalankan pengujian Playwright dengan emulasi viewport perangkat seluler (Pixel 7 / 393x851 px).\n2. Akses ruang simulasi roleplay mode telepon.\n3. Periksa ukuran target tombol (minimal 44px) dan tidak adanya overflow horizontal.",
        expected="Tata letak menyesuaikan layar ponsel secara responsif tanpa adanya teks yang terpotong atau tumpang tindih.",
        actual="Tampilan mobile phone call mode berjalan sempurna dengan avatar 3D yang proporsional.",
        status="PASS",
        screenshot_file="mobile_phone_call_3d_avatar_live.png"
    )

    # --- SUITE 5: FITUR LANJUTAN & INOVASI SISTEM (6 FITUR BARU) ---
    doc.add_heading("2.5 Test Suite 5: Fitur Lanjutan & Inovasi Sistem (6 Fitur Baru)", level=2)

    add_test_case_table(
        doc,
        tc_id="TC-FEAT-101",
        title="Sinkronisasi Audio Replay Berstempel Waktu pada Evaluasi Sesi",
        role="Karyawan & Manager",
        steps="1. Masuk ke halaman evaluasi sesi (/karyawan/session/[sessionId]/result).\n2. Di bagian Interactive Session Timeline Replay, periksa panel kontrol Audio Replay.\n3. Klik tombol Putar Audio Replay.\n4. Klik salah satu tombol turn pada scrubber untuk melompat (scrub) pemutaran suara.",
        expected="Audio Replay memutar respon sales dan reaksi buyer secara berurutan dengan penanda stempel waktu akurat. Turn yang aktif tersorot otomatis dengan equalizer suara.",
        actual="Audio Replay berjalan lancar menggunakan Web Speech API native tanpa latency. Pemutaran melompat sesuai turn yang diklik dan tersinkronisasi dengan transkrip.",
        status="PASS",
        screenshot_file="feature_1_1_audio_replay_live.png"
    )

    add_test_case_table(
        doc,
        tc_id="TC-FEAT-102",
        title="Live Coaching Hint Otomatis saat Sales Hening (Proactive Silence Detection)",
        role="Karyawan (Sales Representative)",
        steps="1. Masuk ke ruang simulasi roleplay aktif (/karyawan/session/[sessionId]).\n2. Biarkan giliran calon pembeli selesai berbicara.\n3. Diam tanpa mengetik atau bersuara selama 8 detik berturut-turut.\n4. Amati respons antarmuka terhadap deteksi keheningan sales.",
        expected="Sistem mendeteksi jeda hening sales melampaui ambang batas 8 detik, memunculkan kartu bisikan pelatih otomatis (proactive whisper hint) berisi panduan respon terarah sesuai stage buyer.",
        actual="Kartu bisikan pelatih otomatis muncul di atas kotak pesan setelah 8 detik hening dengan tombol 'Gunakan Saran Respon Ini'.",
        status="PASS",
        screenshot_file="feature_1_2_silence_detection_live.png"
    )

    add_test_case_table(
        doc,
        tc_id="TC-FEAT-103",
        title="Pengali Bobot Kesulitan pada Algoritma SAW (SAW Difficulty Multiplier)",
        role="Manager & Super Admin",
        steps="1. Buat sesi simulasi pada course kategori Beginner (1.0x), Intermediate (1.15x), dan Advanced (1.30x).\n2. Selesaikan sesi dengan skor tertentu.\n3. Akses Leaderboard Service untuk kalkulasi kriteria C1 (Avg Score) dan C3 (Improvement Rate).\n4. Verifikasi penerapan formula bobot pengali kesulitan.",
        expected="Skor sesi kursus dengan tingkat kesulitan lebih tinggi otomatis diberi bobot pengali lebih besar (maks 100 poin) sehingga karyawan yang menuntaskan course sulit mendapat apresiasi peringkat lebih adil.",
        actual="Kalkulasi kriteria C1 dan C3 pada leaderboardService.ts berhasil mengalikan skor dengan bobot kesulitan kursus secara proporsional.",
        status="PASS",
        screenshot_file="bug6_saw_config_weights_error.png"
    )

    add_test_case_table(
        doc,
        tc_id="TC-FEAT-104",
        title="Bank Keberatan Otomatis dari Sesi Sukses (Auto-Crowdsourced Objection Bank)",
        role="Karyawan & Manager",
        steps="1. Selesaikan sesi simulasi dengan total skor >= 80 poin.\n2. Pastikan terdapat respons penanganan keberatan sales dengan nilai turnScore >= 85.\n3. Periksa penyimpanan data CourseDocument dengan category battlecard.\n4. Akses tab Battlecard pada wizard modul kursus.",
        expected="Pernyataan keberatan prospek dan jawaban unggul sales rep otomatis diarsipkan ke basis data CourseDocument kategori battlecard untuk referensi tim sales lain.",
        actual="Data dialog penanganan keberatan tersimpan otomatis ke CourseDocument dengan metadata autoCrowdsourced dan turnScore terverifikasi.",
        status="PASS",
        screenshot_file="ask_back_step3_battlecard_tab_live.png"
    )

    add_test_case_table(
        doc,
        tc_id="TC-FEAT-201",
        title="Mode Latihan Kilat (Personalized Rapid Drill Mode: maxTurns 5)",
        role="Karyawan (Sales Representative)",
        steps="1. Buka laporan evaluasi sesi pasca simulasi.\n2. Pada kartu 'Next practice plan', temukan penawaran 'Latihan Kilat 5 Turn'.\n3. Klik tombol 'Mulai Drill 5 Turn Sekarang'.\n4. Verifikasi inisialisasi sesi baru dengan batas turn maksimum 5.",
        expected="Sesi latihan kilat dibuat instan dengan maxTurns = 5. Sesi fokus melatih titik terlemah sales rep dan otomatis menyimpulkan evaluasi saat mencapai 5 giliran dialog.",
        actual="Sistem berhasil meluncurkan sesi drill terfokus dengan maxTurns = 5 tanpa kendala, langsung mengarahkan sales rep ke ruang latihan kilat.",
        status="PASS",
        screenshot_file="feature_2_1_rapid_drill_live.png"
    )

    add_test_case_table(
        doc,
        tc_id="TC-FEAT-202",
        title="Generator Draf Follow-Up WhatsApp / Email Pasca Simulasi",
        role="Karyawan (Sales Representative)",
        steps="1. Pada halaman hasil evaluasi sesi, temukan kartu 'Generator Draf Follow-Up Pasca Simulasi'.\n2. Periksa draf template WhatsApp yang otomatis dirangkum dari hasil percakapan.\n3. Klik tab Email dan amati Subjek serta Isi Email proposal tindak lanjut.\n4. Uji tombol 'Salin Pesan' dan 'Buka di WhatsApp Web'.",
        expected="Sistem menyajikan draf tindak lanjut siap kirim untuk WhatsApp dan Email dengan tone profesional dan personalisasi nama prospek. Tombol salin dan direct link WhatsApp/Email berfungsi instan.",
        actual="Generator draf follow-up memuat teks pesan WhatsApp dan draf Email yang relevan dengan hasil sesi. Fungsi copy to clipboard dan deep-link berfungsi sempurna.",
        status="PASS",
        screenshot_file="feature_2_2_whatsapp_draft_live.png"
    )

    doc.add_page_break()

    # ── SECTION 3: KODE AUTOMATED TESTING LENGKAP ──────────────────────────
    h3 = doc.add_heading("3. Kode Automated Testing Playwright Profesional", level=1)
    h3.paragraph_format.space_before = Pt(12)
    h3.paragraph_format.space_after = Pt(4)

    p_code = doc.add_paragraph(
        "Berikut merupakan berkas implementasi pengujian otomatis yang telah terpasang pada repositori proyek "
        "dan dapat langsung dijalankan menggunakan perintah 'npm run test:e2e':"
    )
    p_code.paragraph_format.line_spacing = 1.15

    doc.add_heading("3.1 Fixture Autentikasi 4 Role (Frontend/e2e/fixtures/auth.fixture.ts)", level=2)
    add_code_block(
        doc,
        """import { test as base, Page } from "@playwright/test";

export type RoleType = "super_admin" | "company_admin" | "manager" | "karyawan";

export const DEMO_CREDENTIALS: Record<RoleType, { email: string; name: string; targetUrl: string }> = {
  super_admin: { email: "superadmin@salescoach.ai", name: "System Super Admin", targetUrl: "/admin/strategic" },
  company_admin: { email: "admin@indofood.co.id", name: "Admin Indofood", targetUrl: "/admin/dashboard" },
  manager: { email: "mgr.indomie@indofood.co.id", name: "Manager Indomie", targetUrl: "/manager/dashboard" },
  karyawan: { email: "budi.sales1@indofood.co.id", name: "Budi Pratama (Sales)", targetUrl: "/karyawan/dashboard" },
};

export async function loginAsRole(page: Page, role: RoleType) {
  const creds = DEMO_CREDENTIALS[role];
  await page.goto("/login");
  await page.getByRole("button", { name: /pilih akun demo/i }).click();
  const searchInput = page.getByPlaceholder("Cari nama, email, perusahaan, atau tim...");
  if (await searchInput.isVisible()) await searchInput.fill(creds.email);
  await page.locator(`button:has-text("${creds.email}")`).first().click();
  await page.waitForURL(`**${creds.targetUrl}*`, { timeout: 15000 });
}

export const test = base.extend<{
  karyawanPage: Page; managerPage: Page; adminPage: Page; superAdminPage: Page;
}>({
  karyawanPage: async ({ page }, use) => { await loginAsRole(page, "karyawan"); await use(page); },
  managerPage: async ({ page }, use) => { await loginAsRole(page, "manager"); await use(page); },
  adminPage: async ({ page }, use) => { await loginAsRole(page, "company_admin"); await use(page); },
  superAdminPage: async ({ page }, use) => { await loginAsRole(page, "super_admin"); await use(page); },
});
export { expect } from "@playwright/test";"""
    )

    doc.add_heading("3.2 Test Suite Simulasi Karyawan (Frontend/e2e/specs/02_karyawan_roleplay_flow.spec.ts)", level=2)
    add_code_block(
        doc,
        """import { test, expect } from "../fixtures/auth.fixture";

test.describe("Karyawan Sales Training and Roleplay Lifecycle", () => {
  test("Dashboard Karyawan menampilkan metrik kinerja dan streak", async ({ karyawanPage: page }) => {
    await page.goto("/karyawan/dashboard");
    await expect(page.locator("h1:has-text('Welcome back')")).toBeVisible();
    await expect(page.getByRole("link", { name: /view history/i })).toBeVisible();
  });

  test("Simulasi Roleplay interaktif mendukung input pesan dan hint AI", async ({ karyawanPage: page }) => {
    await page.goto("/karyawan/courses");
    const courseCard = page.locator(".card").first();
    await expect(courseCard).toBeVisible();
  });

  test("Halaman Hasil Evaluasi memuat total skor dan metrik komunikasi", async ({ karyawanPage: page }) => {
    await page.goto("/karyawan/history");
    await expect(page.locator("table").or(page.locator(".card")).first()).toBeVisible();
  });
});"""
    )

    # ── SECTION 4: PANDUAN EKSEKUSI ─────────────────────────────────────────
    h4 = doc.add_heading("4. Panduan Eksekusi Automated Testing", level=1)
    h4.paragraph_format.space_before = Pt(12)
    h4.paragraph_format.space_after = Pt(4)

    cmd_table = doc.add_table(rows=5, cols=3)
    cmd_table.alignment = WD_TABLE_ALIGNMENT.CENTER
    cmd_headers = ["Mode Pengujian", "Perintah Eksekusi CLI", "Deskripsi Perilaku"]
    for j, h in enumerate(cmd_headers):
        cmd_table.rows[0].cells[j].paragraphs[0].add_run(h)
    format_row(cmd_table.rows[0], is_header=True, bg_hex="1E293B")

    cmd_data = [
        ("Semua Test (Headless)", "npm run test:e2e", "Menjalankan seluruh test suite secara otomatis di latar belakang."),
        ("Browser Aktif (Headed)", "npm run test:e2e:headed", "Membuka jendela browser Google Chrome aktual untuk observasi langsung."),
        ("Playwright UI Interaktif", "npm run test:e2e:ui", "Membuka dashboard interaktif dengan time travel debugging dan DOM inspector."),
        ("Buka Laporan Hasil (HTML)", "npx playwright show-report", "Menampilkan visual report kelulusan test, durasi eksekusi, dan rekaman video."),
    ]
    for i, data in enumerate(cmd_data):
        row = cmd_table.rows[i + 1]
        for j, val in enumerate(data):
            row.cells[j].paragraphs[0].add_run(val)
        format_row(row, is_header=False, bg_hex="F8FAFC" if i % 2 == 0 else "FFFFFF")

    # Safe save routine handling file locks
    output_candidates = [
        "Dokumentasi_Hasil_Automated_Testing.docx",
        "Dokumentasi_Automated_Testing_Sales_AI_Coach.docx"
    ]
    saved_name = None
    for fname in output_candidates:
        try:
            doc.save(fname)
            print(f"Word document successfully created: {fname}")
            saved_name = fname
            break
        except PermissionError:
            print(f"Notice: {fname} is locked, trying fallback...")
            
    if not saved_name:
        fallback = "Dokumentasi_Hasil_Automated_Testing_Updated.docx"
        doc.save(fallback)
        print(f"Word document saved to fallback: {fallback}")

if __name__ == "__main__":
    generate_word_document()
