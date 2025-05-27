import React from 'react';

export interface ModalProps {
    showModal: boolean;
    children: React.ReactNode;
    onClose: () => void;
}
