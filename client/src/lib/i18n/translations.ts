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
      }
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
    common: {
      viewMenu: "Lihat Menu Kami",
      price: "Rp {price}",
      description: "Deskripsi",
      category: "Kategori"
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
      }
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
    common: {
      viewMenu: "View Our Menu",
      price: "IDR {price}",
      description: "Description",
      category: "Category"
    }
  }
} as const;
