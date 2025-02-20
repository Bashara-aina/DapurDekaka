export type Language = 'id' | 'en';

export const translations = {
  id: {
    menu: {
      title: "Menu Kami",
      categories: {
        special: "Spesial",
        vegetarian: "Vegetarian",
        seafood: "Hidangan Laut",
        spicy: "Pedas",
        classic: "Klasik"
      },
      orderNow: "Pesan Sekarang",
      orderButton: "Pesan",
      priceLabel: "Harga",
      details: {
        ingredients: "Bahan",
        preparation: "Cara Penyajian",
        spicyLevel: "Tingkat Kepedasan"
      },
      items: {
        hakau: {
          name: "Hakau",
          description: "Pangsit udang kristal dengan kulit transparan yang lembut"
        },
        siomai: {
          name: "Siomay",
          description: "Pangsit daging ayam dan udang dengan tambahan jamur"
        },
        // Add more menu items here
      },
      sauces: {
        chiliOil: {
          name: "Minyak Cabai",
          description: "Minyak cabai yang pedas dan aromatik"
        },
        soySauce: {
          name: "Kecap Asin",
          description: "Kecap asin premium pilihan"
        },
        // Add more sauces here
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
      price: "Rp {price}",
      description: "Deskripsi",
      category: "Kategori",
      readMore: "Baca Selengkapnya",
      loadMore: "Muat Lebih Banyak",
      notFound: "Halaman Tidak Ditemukan",
      backHome: "Kembali ke Beranda",
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
      featured: {
        dimSumArt: {
          title: "Seni Dimsum: Perjalanan Kuliner",
          summary: "Temukan sejarah dan tradisi di balik dimsum, dari awal mulanya hingga interpretasi modern.",
          content: "Dimsum, yang secara harfiah berarti \"sentuh hati\" dalam bahasa Kanton, telah menjadi tradisi kuliner yang dicintai selama berabad-abad. Bentuk seni kuliner ini berawal dari kedai teh di Tiongkok kuno, di mana para pelancong di Jalur Sutra berhenti untuk beristirahat dan menyegarkan diri."
        },
        dimSumVarieties: {
          title: "Variasi Dimsum Penting yang Harus Diketahui Pecinta Makanan",
          summary: "Pelajari tentang hidangan dimsum paling populer dan karakteristik uniknya.",
          content: "Bagi pendatang baru di dunia dimsum, variasi hidangan bisa sangat beragam. Berikut panduan Anda untuk klasik yang wajib dicoba: 1. Har Gow, 2. Siu Mai, 3. Char Siu Bao, 4. Cheung Fun, 5. Lo Mai Gai"
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
      }
    },
    admin: {
      dashboard: {
        title: "Dasbor Admin",
        welcome: "Selamat Datang di Panel Admin",
        pages: "Halaman",
        blog: "Blog",
        orders: "Pesanan",
        settings: "Pengaturan"
      },
      pages: {
        title: "Manajemen Halaman",
        home: "Halaman Utama",
        about: "Halaman Tentang",
        menu: "Halaman Menu",
        contact: "Halaman Kontak",
        edit: "Edit {page}",
        save: "Simpan Perubahan",
        cancel: "Batal",
        success: "Perubahan berhasil disimpan",
        error: "Gagal menyimpan perubahan"
      }
    }
  },
  en: {
    menu: {
      title: "Our Menu",
      categories: {
        special: "Special",
        vegetarian: "Vegetarian",
        seafood: "Seafood",
        spicy: "Spicy",
        classic: "Classic"
      },
      orderNow: "Order Now",
      orderButton: "Order",
      priceLabel: "Price",
      details: {
        ingredients: "Ingredients",
        preparation: "Preparation",
        spicyLevel: "Spicy Level"
      },
      items: {
        hakau: {
          name: "Har Gow",
          description: "Crystal shrimp dumplings with translucent skin"
        },
        siomai: {
          name: "Siu Mai",
          description: "Chicken and shrimp dumplings with mushroom"
        },
        // Add more menu items here
      },
      sauces: {
        chiliOil: {
          name: "Chili Oil",
          description: "Spicy and aromatic chili oil"
        },
        soySauce: {
          name: "Soy Sauce",
          description: "Premium selected soy sauce"
        },
        // Add more sauces here
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
      price: "IDR {price}",
      description: "Description",
      category: "Category",
      readMore: "Read More",
      loadMore: "Load More",
      notFound: "Page Not Found",
      backHome: "Back to Home",
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
      featured: {
        dimSumArt: {
          title: "The Art of Dim Sum: A Culinary Journey",
          summary: "Discover the rich history and traditions behind dim sum, from its humble beginnings to modern interpretations.",
          content: "Dim sum, which literally means \"touch the heart\" in Cantonese, has been a beloved culinary tradition for centuries. This delicate art form originated in the tea houses of ancient China, where travelers along the Silk Road would stop for rest and refreshment."
        },
        dimSumVarieties: {
          title: "Essential Dim Sum Varieties Every Food Lover Should Know",
          summary: "Learn about the most popular dim sum dishes and their unique characteristics.",
          content: "For newcomers to dim sum, the variety of dishes can be overwhelming. Here's your guide to the must-try classics: 1. Har Gow, 2. Siu Mai, 3. Char Siu Bao, 4. Cheung Fun, 5. Lo Mai Gai"
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
      }
    },
    admin: {
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
        edit: "Edit {page}",
        save: "Save Changes",
        cancel: "Cancel",
        success: "Changes saved successfully",
        error: "Failed to save changes"
      }
    }
  }
} as const;