import { Button } from "@/components/ui/button";
import { useState } from "react";
// Added MarketplaceModal component
import { MarketplaceModal } from "@/components/MarketplaceModal";

export function Navbar() {
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);

  return (
    <nav>
      {/* ... other navbar content ... */}
      <Button variant="default" size="lg" onClick={() => setMarketplaceOpen(true)}>
        Pesan Sekarang
      </Button>
      <MarketplaceModal isOpen={marketplaceOpen} onClose={() => setMarketplaceOpen(false)} />
      {/* ... rest of navbar content ... */}
    </nav>
  );
}


// Added MarketplaceModal component
export const MarketplaceModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal">
      <div className="modal-content">
        <button onClick={onClose}>Close</button>
        <h2>Choose a Marketplace</h2>
        <div className="marketplace-options">
          <a href="https://shopee.co.id/dapurdekaka" target="_blank" rel="noopener noreferrer">
            <img src="/shopee-logo.png" alt="Shopee" />
            Shopee
          </a>
          <a href="https://instagram.com/dapurdekaka" target="_blank" rel="noopener noreferrer">
            <img src="/instagram-logo.png" alt="Instagram" />
            Instagram
          </a>
          <a href="https://mart.grab.com/id/id/merchant/6-C62BTTXXSB33TE" target="_blank" rel="noopener noreferrer">
            <img src="/grab-logo.png" alt="Grab" />
            Grab
          </a>
        </div>
      </div>
    </div>
  );
};