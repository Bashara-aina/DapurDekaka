export type Language = 'id' | 'en';

export const translations = {
  id: {
    menu: {
      title: "Menu Kami",
      orderNow: "Pesan Sekarang",
      orderButton: "Pesan",
      details: {
        ingredients: "Bahan",
        preparation: "Cara Penyajian",
        spicyLevel: "Tingkat Kepedasan"
      },
      sauces: {
        title: "Saus Kami"
      }
    },
    home: {
      hero: {
        title: "Dapur Dekaka",
        subtitle: "Nikmati Sensasi Dimsum Premium dengan Cita Rasa Autentik!"
      },
      featured: {
        title: "Produk Unggulan",
        subtitle: "Temukan pilihan dimsum paling favorit kami",
        orderNow: "Pesan Sekarang",
        viewDetails: "Lihat Detail"
      },
      latest: {
        title: "Artikel Terbaru",
        subtitle: "Temukan berita dan pembaruan terbaru kami"
      }
    },
    nav: {
      home: "Beranda",
      menu: "Menu",
      about: "Tentang",
      articles: "Artikel",
      contact: "Kontak",
      orderNow: "Pesan Sekarang"
    },
    common: {
      viewMenu: "Lihat Menu Kami",
      description: "Deskripsi",
      readMore: "Baca Selengkapnya",
      loadMore: "Muat Lebih Banyak",
      notFound: "Halaman Tidak Ditemukan",
      backHome: "Kembali ke Beranda",
      buttons: {
        order: "Pesan",
        edit: "Edit",
        delete: "Hapus",
        cancel: "Batal",
        save: "Simpan",
        saveChanges: "Simpan Perubahan",
        saving: "Menyimpan...",
        reset: "Atur Ulang",
        retry: "Coba Lagi",
        viewAll: "Lihat Semua",
        back: "Kembali",
        search: "Cari...",
        share: "Bagikan",
        send: "Kirim",
        create: "Buat",
        update: "Perbarui",
        add: "Tambah",
        confirm: "Konfirmasi"
      },
      messages: {
        success: "Berhasil",
        error: "Gagal",
        loading: "Memuat..."
      },
      placeholders: {
        enterName: "Masukkan nama",
        enterEmail: "Masukkan email",
        enterMessage: "Masukkan pesan",
        searchArticles: "Cari artikel..."
      },
      contact: {
        title: "Hubungi Kami",
        name: "Nama",
        email: "Email",
        message: "Pesan",
        send: "Kirim Pesan"
      }
    },
    articles: {
      readTime: "{minutes} menit membaca",
      publishedOn: "Dipublikasikan pada {date}",
      relatedArticles: "Artikel Terkait",
      backToList: "Kembali ke Daftar Artikel",
      page: "Halaman",
      of: "dari",
      featured: {
        dimSumArt: {
          title: "Seni Dimsum: Perjalanan Kuliner",
          summary: "Temukan sejarah dan tradisi di balik dimsum, dari awal mulanya hingga interpretasi modern.",
          content: "Dimsum, yang secara harfiah berarti \"sentuh hati\" dalam bahasa Kanton, telah menjadi tradisi kuliner yang dicintai selama berabad-abad. Bentuk seni kuliner ini berawal dari kedai teh di Tiongkok kuno, di mana para pelancong di Jalur Sutra berhenti untuk beristirahat dan menyegarkan diri. Saat ini, dimsum telah berkembang menjadi pengalaman bersantap yang canggih yang menggabungkan keahlian kuliner dengan berkumpul bersama."
        },
        dimSumVarieties: {
          title: "Variasi Dimsum Penting yang Harus Diketahui Pecinta Makanan",
          summary: "Pelajari tentang hidangan dimsum paling populer dan karakteristik uniknya.",
          content: "Bagi pendatang baru di dunia dimsum, variasi hidangan bisa sangat beragam. Berikut panduan Anda untuk klasik yang wajib dicoba:\n\n1. Har Gow (Pangsit Udang Kristal): Dikenal dengan kulitnya yang transparan dan isian udang yang lezat\n2. Siu Mai: Pangsit dengan bagian atas terbuka berisi daging babi dan udang\n3. Char Siu Bao: Bakpao kukus lembut berisi daging babi panggang\n4. Cheung Fun: Gulungan mi beras sutra dengan berbagai isian\n5. Lo Mai Gai: Nasi ketan dibungkus daun teratai"
        }
      }
    },
    about: {
      title: "Tentang Kami",
      story: {
        title: "Cerita Kami",
        content: "Dapur Dekaka dimulai dengan hasrat untuk menyajikan dimsum halal premium dengan cita rasa autentik. Kami berkomitmen untuk menggunakan bahan-bahan berkualitas terbaik dan teknik memasak tradisional."
      },
      values: {
        title: "Nilai-Nilai Kami",
        quality: "Kualitas Premium",
        authentic: "Keaslian Rasa",
        halal: "Bersertifikat Halal",
        service: "Pelayanan Terbaik"
      },
      default: {
        pageTitle: "Tentang Dapur Dekaka",
        pageSubtitle: "Pelajari tentang perjalanan kami, nilai-nilai, dan bahan-bahan berkualitas premium yang kami gunakan di Dapur Dekaka",
        mainDescription: "Dapur Dekaka adalah produsen frozen food dimsum berbagai varian yang menggabungkan tradisi kuliner Tiongkok dengan cita rasa autentik Indonesia. Setiap produk kami dibuat dengan bahan-bahan pilihan berkualitas premium dan功夫 (gong fu) - keahlian烹饪 (pengolahan) yang传承 (diturunkan) secara turun-temurun.",
        sectionDescription: "Di Dapur Dekaka, kami sangat bersemangat untuk menghadirkan pengalaman kuliner yang tidak hanya lezat tetapi juga bekualitas. Dengan pengawasan ketat terhadap setiap tahap produksi, kami menjamin kesegaran dan rasa yang konsisten di setiap produk yang kami hasilkan."
      },
      features: {
        premiumMaterials: "Bahan-bahan Premium",
        premiumMaterialsDesc: "Kami hanya menggunakan bahan-bahan terbaik yang dipilih secara cermat, memastikan kualitas dan kesegaran di setiap hidangan.",
        handcrafted: "Keunggulan Buatan Tangan",
        handcraftedDesc: "Setiap potongan dim sum dibuat dengan hati-hati oleh tangan-tangan terampil kami, menjaga tradisi dan keahlian memasak.",
        halal: "Bersertifikat Halal",
        halalDesc: "Nikmati produk kami dengan tenang karena semua produk Dapur Dekaka bersertifikat halal.",
        noPreservatives: "Tanpa Pengawet",
        noPreservativesDesc: "Kesegaran dan rasa alami adalah prioritas kami, tanpa tambahan pengawet buatan."
      },
      cta: "Rasakan perbedaannya dengan dim sum kami yang autentik, beraroma, dan sehat hari ini!"
    },
    auth: {
      loginTitle: "Login Admin",
      registerTitle: "Buat Akun",
      loginSubtitle: "Masuk untuk mengelola artikel blog",
      registerSubtitle: "Buat akun untuk mengelola artikel blog",
      username: "Nama Pengguna",
      email: "Email",
      password: "Kata Sandi",
      loginButton: "Masuk",
      noAccount: "Belum punya akun? Buat satu",
      hasAccount: "Sudah punya akun? Masuk",
      success: {
        login: "Berhasil masuk",
        register: "Akun berhasil dibuat! Anda dapat masuk sekarang."
      },
      error: {
        invalid: "Kredensial tidak valid",
        register: "Registrasi gagal",
        generic: "Terjadi kesalahan"
      }
    },
    contact: {
      page: {
        title: "Hubungi Kami",
        subtitle: "Hubungi kami untuk pertanyaan apa pun tentang dimsum halal premium kami. Kami senang mendengar dari Anda!",
        infoTitle: "Informasi Kontak",
        address: "Alamat",
        phone: "Telepon",
        hours: "Jam Buka",
        daily: "Setiap Hari",
        followUs: "Ikuti Kami",
        quickOrder: "Pesan Cepat",
        orderViaWhatsApp: "Pesan via WhatsApp",
        findUs: "Temukan Kami"
      },
      form: {
        title: "Kirim Pesan",
        name: "Nama Lengkap",
        email: "Email",
        phone: "Nomor Telepon",
        subject: "Subjek",
        message: "Pesan",
        sending: "Mengirim...",
        sendButton: "Kirim Pesan",
        successTitle: "Berhasil!",
        successMessage: "Pesan Anda berhasil dikirim.",
        errorTitle: "Gagal!",
        errorMessage: "Gagal mengirim pesan. Silakan coba lagi.",
        namePlaceholder: "Masukkan nama lengkap Anda",
        emailPlaceholder: "Masukkan alamat email Anda",
        phonePlaceholder: "Masukkan nomor telepon Anda",
        subjectPlaceholder: "Masukkan subjek pesan",
        messagePlaceholder: "Tulis pesan Anda di sini..."
      }
    },
    articles: {
      pageTitle: "Blog & Artikel - Dapur Dekaka",
      pageDescription: "Temukan artikel resep dimsum halal premium, tips memasak, dan budaya kuliner dari Dapur Dekaka",
      metaKeywords: "dimsum halal, blog Dapur Dekaka, resep dimsum, masakan Indonesia, tips memasak, artikel kuliner",
      title: "Blog & Artikel",
      subtitle: "Jelajahi koleksi artikel kami tentang resep dimsum, budaya kuliner, dan tips memasak",
      noResults: "Tidak ada artikel yang sesuai dengan pencarian Anda.",
      foundResults: "Ditemukan {n} artikel yang sesuai dengan \"{searchTerm}\""
    },
    article: {
      notFound: "Artikel Tidak Ditemukan",
      notFoundDesc: "Artikel yang Anda cari tidak ada atau telah dihapus.",
      backToArticles: "Kembali ke Artikel",
      thanksReading: "Terima kasih telah membaca! Bagikan artikel ini:",
      share: "Bagikan",
      moreArticles: "Artikel Lainnya",
      linkCopied: "Link berhasil disalin!"
    },
    notFound: {
      title: "404 Halaman Tidak Ditemukan",
      subtitle: "Sepertinya halaman yang Anda cari tidak ada."
    },
    customers: {
      title: "Pelanggan Kami",
      subtitle: "Dipercaya oleh bisnis di seluruh Indonesia"
    },
    admin: {
      navbar: {
        dashboard: "Admin Dashboard",
        blog: "Blog",
        pages: "Pages"
      },
      dashboard: {
        title: "Admin Dashboard",
        welcome: "Welcome to Admin Panel",
        pages: "Pages",
        blog: "Blog",
        orders: "Orders",
        settings: "Settings"
      },
      pages: {
        title: "Page Management",
        home: "Homepage",
        about: "About Page",
        menu: "Menu Page",
        contact: "Contact Page",
        footer: "Footer",
        footerDesc: "Edit website footer content",
        customers: "Customers Section",
        customersDesc: "Edit customer testimonials and partner logos",
        edit: "Edit {page}",
        save: "Save Changes",
        cancel: "Cancel",
        success: "Changes saved successfully",
        error: "Failed to save changes"
      },
      blog: {
        title: "Blog Posts",
        createNew: "Create New Post",
        editPost: "Edit Blog Post",
        createPost: "Create Blog Post",
        backToPosts: "Back to Posts",
        updatePost: "Update Post",
        moveUp: "Move post up",
        moveDown: "Move post down",
        loggedIn: "Logged In",
        loggedOut: "Logged Out",
        useArrowsToReorder: "Use up and down buttons to change post order.",
        published: "Publish",
        titleLabel: "Title *",
        titlePlaceholder: "Enter blog post title",
        imageLabel: "Image",
        contentLabel: "Content *",
        deleteConfirm: "Are you sure you want to delete this post?",
        excerptLabel: "Excerpt",
        excerptPlaceholder: "Brief summary for previews...",
        authorNameLabel: "Author Name",
        authorNamePlaceholder: "Author name...",
        slugLabel: "URL Slug",
        slugPlaceholder: "auto-generated-from-title",
        categoryLabel: "Category",
        categoryPlaceholder: "Select or type category",
        featuredLabel: "Featured",
        readTimeLabel: "Estimated read time"
      }
    }
  },
  en: {
    menu: {
      title: "Our Menu",
      orderNow: "Order Now",
      orderButton: "Order",
      details: {
        ingredients: "Ingredients",
        preparation: "Preparation",
        spicyLevel: "Spicy Level"
      },
      sauces: {
        title: "Our Sauces"
      }
    },
    home: {
      hero: {
        title: "Dapur Dekaka",
        subtitle: "Experience Premium Dim Sum with Authentic Flavors!"
      },
      featured: {
        title: "Featured Products",
        subtitle: "Discover our most loved dim sum selections",
        orderNow: "Order Now",
        viewDetails: "View Details"
      },
      latest: {
        title: "Latest Articles",
        subtitle: "Discover our latest news and updates"
      }
    },
    nav: {
      home: "Home",
      menu: "Menu",
      about: "About",
      articles: "Articles",
      contact: "Contact",
      orderNow: "Order Now"
    },
    common: {
      viewMenu: "View Our Menu",
      description: "Description",
      readMore: "Read More",
      loadMore: "Load More",
      notFound: "Page Not Found",
      backHome: "Back to Home",
      buttons: {
        order: "Order",
        edit: "Edit",
        delete: "Delete",
        cancel: "Cancel",
        save: "Save",
        saveChanges: "Save Changes",
        saving: "Saving...",
        reset: "Reset",
        retry: "Retry",
        viewAll: "View All",
        back: "Back",
        search: "Search...",
        share: "Share",
        send: "Send",
        create: "Create",
        update: "Update",
        add: "Add",
        confirm: "Confirm"
      },
      messages: {
        success: "Success",
        error: "Error",
        loading: "Loading..."
      },
      placeholders: {
        enterName: "Enter name",
        enterEmail: "Enter email",
        enterMessage: "Enter message",
        searchArticles: "Search articles..."
      },
      contact: {
        title: "Contact Us",
        name: "Name",
        email: "Email",
        message: "Message",
        send: "Send Message"
      }
    },
    articles: {
      readTime: "{minutes} min read",
      publishedOn: "Published on {date}",
      relatedArticles: "Related Articles",
      backToList: "Back to Articles",
      page: "Page",
      of: "of",
      featured: {
        dimSumArt: {
          title: "The Art of Dim Sum: A Culinary Journey",
          summary: "Discover the rich history and traditions behind dim sum, from its humble beginnings to modern interpretations.",
          content: "Dim sum, which literally means \"touch the heart\" in Cantonese, has been a beloved culinary tradition for centuries. This delicate art form originated in the tea houses of ancient China, where travelers along the Silk Road would stop for rest and refreshment. Today, it has evolved into a sophisticated dining experience that combines culinary artistry with social gathering."
        },
        dimSumVarieties: {
          title: "Essential Dim Sum Varieties Every Food Lover Should Know",
          summary: "Learn about the most popular dim sum dishes and their unique characteristics.",
          content: "For newcomers to dim sum, the variety of dishes can be overwhelming. Here's your guide to the must-try classics:\n\n1. Har Gow (Crystal Shrimp Dumplings): Known for their translucent wrappers and succulent shrimp filling\n2. Siu Mai: Open-topped dumplings with pork and shrimp\n3. Char Siu Bao: Fluffy steamed buns filled with barbecue pork\n4. Cheung Fun: Silky rice noodle rolls with various fillings\n5. Lo Mai Gai: Sticky rice wrapped in lotus leaf"
        }
      }
    },
    about: {
      title: "About Us",
      story: {
        title: "Our Story",
        content: "Dapur Dekaka began with a passion for serving premium halal dim sum with authentic flavors. We are committed to using the highest quality ingredients and traditional cooking techniques."
      },
      values: {
        title: "Our Values",
        quality: "Premium Quality",
        authentic: "Authentic Taste",
        halal: "Halal Certified",
        service: "Excellence in Service"
      },
      default: {
        pageTitle: "About Dapur Dekaka",
        pageSubtitle: "Learn about our journey, values, and the premium quality ingredients we use at Dapur Dekaka",
        mainDescription: "Dapur Dekaka is a producer of frozen food dim sum various variants that combine Chinese culinary traditions with authentic Indonesian flavors. Every product we make is made with premium quality selected ingredients and 功夫 (gong fu) - culinary expertise that has been passed down through generations.",
        sectionDescription: "At Dapur Dekaka, we are very passionate about delivering a culinary experience that is not only delicious but also of high quality. With strict supervision at every stage of production, we guarantee freshness and consistent taste in every product we produce."
      },
      features: {
        premiumMaterials: "Premium Materials",
        premiumMaterialsDesc: "We only use the best ingredients that are carefully selected, ensuring quality and freshness in every dish.",
        handcrafted: "Handcrafted Excellence",
        handcraftedDesc: "Every piece of dim sum is made carefully by our skilled hands, maintaining cooking traditions and expertise.",
        halal: "Halal Certified",
        halalDesc: "Enjoy our products with peace of mind as all Dapur Dekaka products are halal certified.",
        noPreservatives: "No Preservatives",
        noPreservativesDesc: "Freshness and natural taste are our priority, without added artificial preservatives."
      },
      cta: "Experience the difference with our authentic, flavorful, and healthy dim sum today!"
    },
    auth: {
      loginTitle: "Admin Login",
      registerTitle: "Create Account",
      loginSubtitle: "Log in to manage your blog posts",
      registerSubtitle: "Create an account to manage blog posts",
      username: "Username",
      email: "Email",
      password: "Password",
      loginButton: "Login",
      noAccount: "Don't have an account? Create one",
      hasAccount: "Already have an account? Login",
      success: {
        login: "Logged in successfully",
        register: "Account created successfully! You can now log in."
      },
      error: {
        invalid: "Invalid credentials",
        register: "Registration failed",
        generic: "An error occurred"
      }
    },
    contact: {
      page: {
        title: "Contact Us",
        subtitle: "Get in touch with us for any inquiries about our premium halal dim sum. We'd love to hear from you!",
        infoTitle: "Contact Information",
        address: "Address",
        phone: "Phone",
        hours: "Opening Hours",
        daily: "Daily",
        followUs: "Follow Us",
        quickOrder: "Quick Order",
        orderViaWhatsApp: "Order via WhatsApp",
        findUs: "Find Us"
      },
      form: {
        title: "Send a Message",
        name: "Full Name",
        email: "Email",
        phone: "Phone Number",
        subject: "Subject",
        message: "Message",
        sending: "Sending...",
        sendButton: "Send Message",
        successTitle: "Success!",
        successMessage: "Your message has been sent successfully.",
        errorTitle: "Failed!",
        errorMessage: "Failed to send message. Please try again.",
        namePlaceholder: "Enter your full name",
        emailPlaceholder: "Enter your email address",
        phonePlaceholder: "Enter your phone number",
        subjectPlaceholder: "Enter message subject",
        messagePlaceholder: "Write your message here..."
      }
    },
    articles: {
      pageTitle: "Blog & Articles - Dapur Dekaka",
      pageDescription: "Discover premium halal dim sum recipes, cooking tips, and food culture articles from Dapur Dekaka",
      metaKeywords: "halal dim sum, Dapur Dekaka blog, dim sum recipes, Indonesian food, cooking tips, food articles",
      title: "Blog & Articles",
      subtitle: "Explore our collection of articles about dim sum recipes, food culture, and cooking tips",
      noResults: "No articles found matching your search criteria.",
      foundResults: "Found {n} articles matching \"{searchTerm}\""
    },
    article: {
      notFound: "Article Not Found",
      notFoundDesc: "The article you're looking for doesn't exist or has been removed.",
      backToArticles: "Back to Articles",
      thanksReading: "Thanks for reading! Share this article:",
      share: "Share",
      moreArticles: "More Articles",
      linkCopied: "Link copied to clipboard!"
    },
    notFound: {
      title: "404 Page Not Found",
      subtitle: "Looks like the page you're looking for doesn't exist."
    },
    customers: {
      title: "Our Customers",
      subtitle: "Trusted by businesses across Indonesia"
    },
    admin: {
      navbar: {
        dashboard: "Admin Dashboard",
        blog: "Blog",
        pages: "Pages"
      },
      dashboard: {
        title: "Admin Dashboard",
        welcome: "Welcome to Admin Panel",
        pages: "Pages",
        blog: "Blog",
        orders: "Orders",
        settings: "Settings"
      },
      pages: {
        title: "Page Management",
        home: "Homepage",
        about: "About Page",
        menu: "Menu Page",
        contact: "Contact Page",
        footer: "Footer",
        footerDesc: "Edit website footer content",
        customers: "Customers Section",
        customersDesc: "Edit customer testimonials and partner logos",
        edit: "Edit {page}",
        save: "Save Changes",
        cancel: "Cancel",
        success: "Changes saved successfully",
        error: "Failed to save changes"
      },
      blog: {
        title: "Blog Posts",
        createNew: "Create New Post",
        editPost: "Edit Blog Post",
        createPost: "Create Blog Post",
        backToPosts: "Back to Posts",
        updatePost: "Update Post",
        moveUp: "Move post up",
        moveDown: "Move post down",
        loggedIn: "Logged In",
        loggedOut: "Logged Out",
        useArrowsToReorder: "Use up and down buttons to change post order.",
        published: "Publish",
        titleLabel: "Title *",
        titlePlaceholder: "Enter blog post title",
        imageLabel: "Image",
        contentLabel: "Content *",
        deleteConfirm: "Are you sure you want to delete this post?",
        excerptLabel: "Excerpt",
        excerptPlaceholder: "Brief summary for previews...",
        authorNameLabel: "Author Name",
        authorNamePlaceholder: "Author name...",
        slugLabel: "URL Slug",
        slugPlaceholder: "auto-generated-from-title",
        categoryLabel: "Category",
        categoryPlaceholder: "Select or type category",
        featuredLabel: "Featured",
        readTimeLabel: "Estimated read time"
      }
    }
  }
} as const;