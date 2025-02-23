import React, { useState } from 'react';
import styled from 'styled-components'; // Assuming styled-components for styling

const ModalContainer = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease-in-out;

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
`;

const ModalContent = styled.div`
  background-color: white;
  padding: 20px;
  border-radius: 5px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  text-align: center;
  max-width: 300px;
  
  @media (max-width: 300px) {
    max-width: 95%;
    margin: 0 5px;
  }
`;

const CloseButton = styled.button`
  position: absolute;
  top: 10px;
  right: 10px;
  border: none;
  background: none;
  cursor: pointer;
  font-size: 1.2rem;
`;

const IconLink = styled.a`
  display: block;
  margin: 10px 0;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 5px;
`;

const OrderModal = ({ children }) => {
  const [showModal, setShowModal] = useState(false);

  const toggleModal = () => {
    setShowModal(!showModal);
  };

  const closeModal = () => {
    setShowModal(false);
  }
  return (
    <>
      {children({ openModal: toggleModal })} {/* Pass the openModal function to the child component */}
      {showModal && (
        <ModalContainer>
          <ModalContent>
            <CloseButton onClick={closeModal}>&times;</CloseButton>
            <h2>Order Options</h2>
            <IconLink href="https://shopee.co.id/dapurdekaka" target="_blank" rel="noopener noreferrer">
              <img src="shopee-logo.png" alt="Shopee" style={{maxWidth: '100%'}}/> {/* Replace with actual logo */}
            </IconLink>
            <IconLink href="https://instagram.com/dapurdekaka" target="_blank" rel="noopener noreferrer">
              <img src="instagram-logo.png" alt="Instagram" style={{maxWidth: '100%'}}/> {/* Replace with actual logo */}
            </IconLink>
            <IconLink href="https://mart.grab.com/id/id/merchant/6-C62BTTXXSB33TE" target="_blank" rel="noopener noreferrer">
              <img src="grab-logo.png" alt="Grab" style={{maxWidth: '100%'}} /> {/* Replace with actual logo */}
            </IconLink>
          </ModalContent>
        </ModalContainer>
      )}
    </>
  );
};

export default OrderModal;

// Example of how to use it in a button:
// <OrderModal>
//   <Button>Pesan Sekarang</Button>
// </OrderModal>

//Remember to replace placeholders like "shopee-logo.png" with actual image paths.