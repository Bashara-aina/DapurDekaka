import { Button } from "@/components/ui/button";
import { useState } from "react";
import { MarketplaceModal } from "@/components/MarketplaceModal";

export default function Home() {
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);

  return (
    <div>
      {/* ... other content ... */}
      <Button onClick={() => setMarketplaceOpen(true)}>Pesan</Button>
      <MarketplaceModal isOpen={marketplaceOpen} onClose={() => setMarketplaceOpen(false)} />
      {/* ... rest of the home page content ... */}
    </div>
  );
}


// Added MarketplaceModal component
import React from 'react';

const marketplaceLinks = [
  { name: 'Shopee', url: 'shopee.co.id/dapurdekaka', logo: '/shopee-logo.png' }, // Replace with actual logo path
  { name: 'Instagram', url: 'Instagram.com/dapurdekaka', logo: '/instagram-logo.png' }, // Replace with actual logo path
  { name: 'Grab', url: 'https://mart.grab.com/id/id/merchant/6-C62BTTXXSB33TE', logo: '/grab-logo.png' }, // Replace with actual logo path
];

const MarketplaceModal = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <button onClick={onClose} className="close-button">X</button>
        <h2>Order Now</h2>
        <ul>
          {marketplaceLinks.map((link) => (
            <li key={link.name}>
              <a href={link.url} target="_blank" rel="noopener noreferrer">
                <img src={link.logo} alt={`${link.name} Logo`} /> {link.name}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export { MarketplaceModal };