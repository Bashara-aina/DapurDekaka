import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);


// Import image utilities
import { setupLazyLoadObserver } from './lib/utils/image-loader';

// Setup global lazy loading after page load
if (typeof window !== 'undefined') {
  // Wait for initial render before setting up lazy loading
  window.addEventListener('load', () => {
    setupLazyLoadObserver();
  });
}
