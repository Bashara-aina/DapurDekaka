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
      orderNow: "Pesan Sekarang"
    },
    home: {
      hero: {
        title: "Dapur Dekaka",
        subtitle: "Nikmati Sensasi Dimsum Premium dengan Cita Rasa Autentik!"
      },
      featured: {
        title: "Produk Unggulan",
        subtitle: "Temukan pilihan dimsum paling favorit kami"
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
      backToList: "Kembali ke Daftar Artikel"
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
      orderNow: "Order Now"
    },
    home: {
      hero: {
        title: "Dapur Dekaka",
        subtitle: "Experience Premium Dim Sum with Authentic Flavors!"
      },
      featured: {
        title: "Featured Products",
        subtitle: "Discover our most loved dim sum selections"
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
      backToList: "Back to Articles"
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
    }
  }
} as const;