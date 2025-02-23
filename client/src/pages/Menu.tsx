import { Button } from "@/components/ui/button";
import { useState } from "react";
import { MarketplaceModal } from "@/components/MarketplaceModal";

export default function Menu() {
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);

  return (
    <div>
      <Button onClick={() => setMarketplaceOpen(true)}>Pesan</Button>
      <MarketplaceModal isOpen={marketplaceOpen} onClose={() => setMarketplaceOpen(false)} />
      {/* Rest of the Menu component */}
    </div>
  );
}


//This is a placeholder, a real implementation would need styling and potentially error handling
export const MarketplaceModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal">
      <div className="modal-content">
        <button onClick={onClose}>Close</button>
        <h2>Choose your Marketplace:</h2>
        <a href="https://shopee.co.id/dapurdekaka" target="_blank" rel="noopener noreferrer">
          <img src="/shopee-logo.png" alt="Shopee Logo" /> Shopee
        </a>
        <a href="https://www.instagram.com/dapurdekaka" target="_blank" rel="noopener noreferrer">
          <img src="/instagram-logo.png" alt="Instagram Logo" /> Instagram
        </a>
        <a href="https://mart.grab.com/id/id/merchant/6-C62BTTXXSB33TE" target="_blank" rel="noopener noreferrer">
          <img src="/grab-logo.png" alt="Grab Logo" /> Grab
        </a>
      </div>
    </div>
  );
};