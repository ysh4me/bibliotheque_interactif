class UIService {
    constructor() {
        this.elements = {
            bookModal: null,
            addBookModal: null,
            modalTitle: null,
            modalContent: null,
            addBookForm: null,
            bookSearchInput: null,
            searchResults: null,
            searchNavbar: null,
            addBookBtn: null,
            closeModalBtn: null,
            cancelAddBtn: null,
            columns: {},
            loadingOverlay: null,
            messageContainer: null
        };
        
        this.state = {
            isLoading: false,
            activeModal: null,
            searchTimeout: null
        };
        
        this.config = {
            searchDelay: 500,
            animationDuration: 300,
            messageTimeout: 5000
        };
        
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupUI());
        } else {
            this.setupUI();
        }
    }

    setupUI() {
        this.cacheElements();
        this.setupEventListeners();
        this.createUIElements();
        this.initializeFeatures();
    }

    cacheElements() {
        this.elements = {
            bookModal: document.getElementById('book-modal'),
            addBookModal: document.getElementById('add-book-modal'),
            modalTitle: document.getElementById('modal-title'),
            modalContent: document.getElementById('modal-content'),
            addBookForm: document.getElementById('add-book-form'),
            bookSearchInput: document.getElementById('book-search'),
            searchResults: document.getElementById('search-results'),
            searchNavbar: document.getElementById('search-navbar'),
            addBookBtn: document.getElementById('add-book-btn'),
            closeModalBtn: document.getElementById('close-modal'),
            cancelAddBtn: document.getElementById('cancel-add'),
            columns: {
                'to-read': document.getElementById('column-to-read'),
                'reading': document.getElementById('column-reading'),
                'read': document.getElementById('column-read'),
                'favorites': document.getElementById('column-favorites')
            }
        };
        
        this.validateElements();
    }

    validateElements() {
        const required = ['bookModal', 'addBookModal', 'addBookBtn'];
        const missing = required.filter(key => !this.elements[key]);
        
        if (missing.length > 0) {
            throw new Error(`Éléments DOM requis manquants: ${missing.join(', ')}`);
        }
    }

    setupEventListeners() {
        if (this.elements.addBookBtn) {
            this.elements.addBookBtn.addEventListener('click', () => this.openAddBookModal());
        }
        
        if (this.elements.closeModalBtn) {
            this.elements.closeModalBtn.addEventListener('click', () => this.closeBookModal());
        }
        
        if (this.elements.cancelAddBtn) {
            this.elements.cancelAddBtn.addEventListener('click', () => this.closeAddBookModal());
        }
        
        this.setupModalOverlayListeners();
        
        if (this.elements.bookSearchInput) {
            this.elements.bookSearchInput.addEventListener('input', (e) => {
                this.handleBookSearch(e.target.value);
            });
        }
        
        if (this.elements.searchNavbar) {
            this.elements.searchNavbar.addEventListener('input', (e) => {
                this.handleNavbarSearch(e.target.value);
            });
        }
        
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        window.addEventListener('resize', () => this.handleResize());
    }

    setupModalOverlayListeners() {
        [this.elements.bookModal, this.elements.addBookModal].forEach(modal => {
            if (modal) {
                modal.addEventListener('click', (e) => {
                    if (e.target === modal) {
                        this.closeActiveModal();
                    }
                });
            }
        });
    }

    createUIElements() {
        this.createLoadingOverlay();
        this.createMessageContainer();
        this.enhanceDropZones();
    }

    createLoadingOverlay() {
        const loadingOverlay = document.createElement('div');
        loadingOverlay.id = 'loading-overlay';
        loadingOverlay.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 hidden';
        loadingOverlay.innerHTML = `
            <div class="bg-white rounded-lg p-6 flex items-center space-x-4">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <span class="text-gray-700">Chargement...</span>
            </div>
        `;
        
        document.body.appendChild(loadingOverlay);
        this.elements.loadingOverlay = loadingOverlay;
    }

    createMessageContainer() {
        const messageContainer = document.createElement('div');
        messageContainer.id = 'message-container';
        messageContainer.className = 'fixed top-4 right-4 z-50 space-y-2';
        
        document.body.appendChild(messageContainer);
        this.elements.messageContainer = messageContainer;
    }

    enhanceDropZones() {
        Object.values(this.elements.columns).forEach(column => {
            if (column) {
                column.classList.add('transition-all', 'duration-200');
                this.updateEmptyColumnState(column);
            }
        });
    }

    updateEmptyColumnState(column) {
        const hasBooks = column.children.length > 0;
        
        if (!hasBooks) {
            if (!column.querySelector('.empty-state')) {
                const emptyState = document.createElement('div');
                emptyState.className = 'empty-state text-center pt-8 pb-[22rem] text-gray-400 border-2 border-dashed border-gray-200 rounded-lg';
                emptyState.innerHTML = `
                    <svg class="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                    </svg>
                    <p class="text-sm">Glissez un livre ici</p>
                `;
                column.appendChild(emptyState);
            }
        } else {
            const emptyState = column.querySelector('.empty-state');
            if (emptyState) {
                emptyState.remove();
            }
        }
    }

    initializeFeatures() {
        this.initializeTooltips();
        this.initializeAnimations();
        this.updateAllColumnsState();
    }

    initializeTooltips() {
        const tooltipElements = document.querySelectorAll('[data-tooltip]');
        tooltipElements.forEach(element => {
            this.setupTooltip(element);
        });
    }

    setupTooltip(element) {
        const tooltipText = element.getAttribute('data-tooltip');
        if (!tooltipText) return;
        
        let tooltip = null;
        
        element.addEventListener('mouseenter', () => {
            tooltip = this.createTooltip(tooltipText);
            document.body.appendChild(tooltip);
            this.positionTooltip(tooltip, element);
        });
        
        element.addEventListener('mouseleave', () => {
            if (tooltip) {
                tooltip.remove();
                tooltip = null;
            }
        });
    }

    createTooltip(text) {
        const tooltip = document.createElement('div');
        tooltip.className = 'absolute bg-gray-800 text-white text-sm px-2 py-1 rounded shadow-lg z-50 pointer-events-none';
        tooltip.textContent = text;
        return tooltip;
    }

    positionTooltip(tooltip, element) {
        const rect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        tooltip.style.left = `${rect.left + (rect.width - tooltipRect.width) / 2}px`;
        tooltip.style.top = `${rect.top - tooltipRect.height - 5}px`;
    }

    openAddBookModal() {
        
        if (this.elements.addBookModal) {
            this.elements.addBookModal.classList.remove('hidden');
            this.state.activeModal = 'add-book';
            
            if (this.elements.bookSearchInput) {
                setTimeout(() => {
                    this.elements.bookSearchInput.focus();
                }, 100);
            }
            
            this.clearSearchResults();
        }
    }

    closeAddBookModal() {
        if (this.elements.addBookModal) {
            this.elements.addBookModal.classList.add('hidden');
            this.state.activeModal = null;
            this.resetAddBookForm();
        }
    }

    openBookModal(bookData) {
        if (this.elements.bookModal) {
            this.populateBookModal(bookData);
            this.elements.bookModal.classList.remove('hidden');
            this.state.activeModal = 'book-details';
        }
    }

    closeBookModal() {
        if (this.elements.bookModal) {
            this.elements.bookModal.classList.add('hidden');
            this.state.activeModal = null;
        }
    }

    closeActiveModal() {
        switch (this.state.activeModal) {
            case 'add-book':
                this.closeAddBookModal();
                break;
            case 'book-details':
                this.closeBookModal();
                break;
        }
    }

    populateBookModal(book) {
        if (this.elements.modalTitle) {
            this.elements.modalTitle.textContent = book.title;
        }
        
        if (this.elements.modalContent) {
            this.elements.modalContent.innerHTML = this.generateBookModalContent(book);
            this.setupBookModalInteractions(book);
        }
    }

    generateBookModalContent(book) {
        const authors = Array.isArray(book.authors) ? book.authors.join(', ') : book.authors;
        const categories = Array.isArray(book.categories) ? book.categories.join(', ') : book.categories;
        
        return `
            <div class="flex flex-col md:flex-row gap-4">
                <div class="flex-shrink-0">
                    <img src="${book.cover || book.thumbnail}" 
                         alt="${book.title}" 
                         class="w-32 h-48 object-cover rounded-lg shadow-md mx-auto md:mx-0"
                         onerror="this.src='assets/images/placeholder.jpg'">
                </div>
                
                <div class="flex-1">
                    <div class="mb-4">
                        <p class="text-gray-600 mb-2"><strong>Auteur(s):</strong> ${authors}</p>
                        <p class="text-gray-600 mb-2"><strong>Éditeur:</strong> ${book.publisher || 'Non spécifié'}</p>
                        <p class="text-gray-600 mb-2"><strong>Date:</strong> ${book.publishedDate || 'Non spécifiée'}</p>
                        <p class="text-gray-600 mb-2"><strong>Pages:</strong> ${book.pageCount || 'Non spécifié'}</p>
                        <p class="text-gray-600 mb-2"><strong>Catégories:</strong> ${categories}</p>
                    </div>
                    
                    <div class="mb-4">
                        <h4 class="font-semibold mb-2">Ma note:</h4>
                        <div class="flex items-center space-x-1" data-book-rating="${book.id}">
                            ${this.generateStarRating(book.rating || 0)}
                        </div>
                    </div>
                    
                    <div class="mb-4">
                        <h4 class="font-semibold mb-2">Mon commentaire:</h4>
                        <textarea 
                            class="w-full p-2 border rounded-md resize-none" 
                            rows="3" 
                            placeholder="Ajoutez votre commentaire..."
                            data-book-comment="${book.id}">${book.comment || ''}</textarea>
                    </div>
                    
                    <div class="mb-4">
                        <h4 class="font-semibold mb-2">Statut:</h4>
                        <select class="w-full p-2 border rounded-md" data-book-status="${book.id}">
                            <option value="to-read" ${book.status === 'to-read' ? 'selected' : ''}>À lire</option>
                            <option value="reading" ${book.status === 'reading' ? 'selected' : ''}>En cours</option>
                            <option value="read" ${book.status === 'read' ? 'selected' : ''}>Lu</option>
                            <option value="favorites" ${book.status === 'favorites' ? 'selected' : ''}>Favoris</option>
                        </select>
                    </div>
                    
                    ${book.status === 'reading' ? this.generateProgressBar(book.progress || 0) : ''}
                </div>
            </div>
            
            <div class="mt-6">
                <h4 class="font-semibold mb-2">Description:</h4>
                <p class="text-gray-700 text-sm leading-relaxed">${book.description}</p>
            </div>
            
            <div class="mt-6 flex justify-between">
                <button class="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition" 
                        data-delete-book="${book.id}">
                    Supprimer
                </button>
                <button class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition" 
                        data-save-book="${book.id}">
                    Sauvegarder
                </button>
            </div>
        `;
    }

    generateStarRating(rating) {
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            const filled = i <= rating ? 'filled' : '';
            const starIcon = i <= rating ? '⭐' : '☆';
            starsHtml += `<span class="star cursor-pointer hover:text-yellow-400 transition-colors ${filled}" data-rating="${i}">${starIcon}</span>`;
        }

        return starsHtml;
    }

    generateProgressBar(progress) {
        return `
            <div class="mb-4">
                <h4 class="font-semibold mb-2">Progression:</h4>
                <div class="flex items-center space-x-2">
                    <input type="range" min="0" max="100" value="${progress}" 
                           class="flex-1" data-book-progress="${progress}">
                    <span class="text-sm text-gray-600">${progress}%</span>
                </div>
            </div>
        `;
    }

    setupBookModalInteractions(book) {
        const starsContainer = this.elements.modalContent.querySelector(`[data-book-rating="${book.id}"]`);
        
        if (starsContainer) {
            const stars = starsContainer.querySelectorAll('.star');
            stars.forEach(star => {
                star.addEventListener('click', (e) => {
                    e.preventDefault();
                    const rating = parseInt(e.target.getAttribute('data-rating'));
                    this.updateStarRating(stars, rating);
                });
                
                star.addEventListener('mouseenter', (e) => {
                    const rating = parseInt(e.target.getAttribute('data-rating'));
                    this.previewStarRating(stars, rating);
                });
            });
            
            starsContainer.addEventListener('mouseleave', () => {
                const currentRating = starsContainer.querySelectorAll('.star.filled').length;
                this.updateStarRating(stars, currentRating);
            });
        }
        
        const progressInput = this.elements.modalContent.querySelector('[data-book-progress]');
        if (progressInput) {
            progressInput.addEventListener('input', (e) => {
                const progressText = e.target.nextElementSibling;
                if (progressText) {
                    progressText.textContent = `${e.target.value}%`;
                }
            });
        }
        
        const saveBtn = this.elements.modalContent.querySelector('[data-save-book]');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveBookChanges(book.id);
            });
        }
        
        const deleteBtn = this.elements.modalContent.querySelector('[data-delete-book]');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                this.confirmDeleteBook(book.id);
            });
        }
    }

    previewStarRating(stars, rating) {
        stars.forEach((star, index) => {
            star.style.color = index < rating ? '#fbbf24' : '#d1d5db';
        });
    }

    updateStarRating(stars, rating) {
        stars.forEach((star, index) => {
            if (index < rating) {
                star.classList.add('filled');
                star.style.color = '#fbbf24';
            } else {
                star.classList.remove('filled');
                star.style.color = '#d1d5db';
            }
        });
    }

    saveBookChanges(bookId) {
        const modalContent = this.elements.modalContent;
        
        const filledStars = modalContent.querySelectorAll('.star.filled');
        const rating = filledStars.length;
        
        const comment = modalContent.querySelector(`[data-book-comment="${bookId}"]`)?.value || '';
        const status = modalContent.querySelector(`[data-book-status="${bookId}"]`)?.value || '';
        const progressInput = modalContent.querySelector(`[data-book-progress]`);
        const progress = progressInput ? parseInt(progressInput.value) : 0;
        
        const event = new CustomEvent('bookUpdated', {
            detail: { bookId, rating, comment, status, progress }
        });
        document.dispatchEvent(event);
        
        this.showMessage('Livre mis à jour avec succès!', 'success');
        this.closeBookModal();
    }

    confirmDeleteBook(bookId) {
        if (confirm('Êtes-vous sûr de vouloir supprimer ce livre ?')) {
            const event = new CustomEvent('bookDeleted', {
                detail: { bookId }
            });
            document.dispatchEvent(event);
            
            this.showMessage('Livre supprimé avec succès!', 'success');
            this.closeBookModal();
        }
    }

    handleBookSearch(query) {
        if (this.state.searchTimeout) {
            clearTimeout(this.state.searchTimeout);
        }
        
        if (!query || query.trim().length === 0) {
            this.clearSearchResults();
            return;
        }
        
        if (query.trim().length < 2) {
            this.clearSearchResults();
            return;
        }
        
        this.state.searchTimeout = setTimeout(() => {
            this.performBookSearch(query);
        }, this.config.searchDelay);
    }

    async performBookSearch(query) {
        if (!query || query.trim().length < 2) {
            this.clearSearchResults();
            return;
        }
        
        try {
            this.showSearchLoading(true);
            const books = await apiService.searchBooks(query);
            this.displaySearchResults(books);
        } catch (error) {
            this.showMessage('Erreur lors de la recherche', 'error');
        } finally {
            this.showSearchLoading(false);
        }
    }

    displaySearchResults(books) {
        if (!this.elements.searchResults) return;
        
        if (books.length === 0) {
            this.elements.searchResults.innerHTML = `
                <div class="text-center py-4 text-gray-500">
                    <p>Aucun livre trouvé</p>
                </div>
            `;
            return;
        }
        
        const resultsHtml = books.map(book => this.generateSearchResultItem(book)).join('');
        this.elements.searchResults.innerHTML = `
            <div class="mb-3 text-xs text-gray-500 px-3">
                ${books.length} livre(s) trouvé(s) - Cliquez sur un livre pour l'ajouter
            </div>
            ${resultsHtml}
        `;
        
        this.setupSearchResultsEvents();
    }

    generateSearchResultItem(book) {
        const authors = Array.isArray(book.authors) ? book.authors.join(', ') : book.authors;
        
        return `
            <div class="flex items-center space-x-3 p-3 border hover:bg-gray-50 cursor-pointer transition border-l-4 border-l-transparent hover:border-l-blue-500" 
                data-book-id="${book.id}" 
                title="Cliquez pour ajouter ce livre à votre bibliothèque">
                <img src="${book.thumbnail}" 
                    alt="${book.title}" 
                    class="w-12 h-16 object-cover rounded shadow-sm"
                    onerror="this.src='assets/images/placeholder.jpg'">
                <div class="flex-1 min-w-0">
                    <h4 class="font-medium text-sm truncate text-gray-900">${book.title}</h4>
                    <p class="text-xs text-gray-600 truncate">${authors}</p>
                    <p class="text-xs text-gray-500">${book.publishedDate || 'Date inconnue'}</p>
                </div>
                <div class="flex-shrink-0 text-blue-500">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                    </svg>
                </div>
            </div>
        `;
    }

    setupSearchResultsEvents() {
        const resultItems = this.elements.searchResults.querySelectorAll('[data-book-id]');
        resultItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const bookId = item.getAttribute('data-book-id');
                
                item.style.transform = 'scale(0.98)';
                item.style.backgroundColor = '#dbeafe';
                
                setTimeout(() => {
                    item.style.transform = '';
                    item.style.backgroundColor = '';
                }, 150);
                
                this.addBookFromSearch(bookId);
            });
            
            item.addEventListener('mouseenter', () => {
                item.style.backgroundColor = '#f8fafc';
            });
            
            item.addEventListener('mouseleave', () => {
                item.style.backgroundColor = '';
            });
        });
    }

    async addBookFromSearch(bookId) {
        try {
            
            if (!window.apiService) {
                throw new Error('Service API non disponible');
            }
            
            if (!window.bookManager) {
                throw new Error('Gestionnaire de livres non disponible');
            }
            
            this.showSearchLoading(true);
            
            const bookDetails = await window.apiService.getBookDetails(bookId);
            
            if (bookDetails) {
                if (window.bookManager.isBookInMyLibrary(bookId)) {
                    this.showMessage('Ce livre est déjà dans votre bibliothèque !', 'warning');
                    return;
                }
                
                const success = window.bookManager.addGoogleBookToMyLibrary(bookDetails);
                
                if (success) {
                    this.showMessage('📚 Livre ajouté avec succès!', 'success');
                    this.closeAddBookModal();
                } else {
                    throw new Error('Échec de l\'ajout du livre');
                }
            } else {
                throw new Error('Impossible de récupérer les détails du livre');
            }
        } catch (error) {
            this.showMessage(`Erreur: ${error.message}`, 'error');
        } finally {
            this.showSearchLoading(false);
        }
    }

    async showBookPreview(bookId) {
        try {
            const bookDetails = await apiService.getBookDetails(bookId);
            if (bookDetails) {
                this.showQuickPreview(bookDetails);
            }
        } catch (error) {

        }
    }

    showQuickPreview(book) {
        const preview = document.createElement('div');
        preview.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
        preview.innerHTML = `
            <div class="bg-white rounded-lg p-4 max-w-[50rem] m-4">
                <div class="flex items-start space-x-3">
                    <img src="${book.thumbnail}" alt="${book.title}" class="w-16 h-24 object-cover rounded">
                    <div class="flex-1">
                        <h3 class="font-bold text-sm mb-1">${book.title}</h3>
                        <p class="text-xs text-gray-600 mb-2">${book.authors.join(', ')}</p>
                        <p class="text-xs text-gray-700 line-clamp-3">${book.description}</p>
                    </div>
                </div>
                <div class="mt-3 flex justify-end space-x-2">
                    <button class="text-xs px-3 py-1 text-gray-600 hover:text-gray-800" onclick="this.closest('.fixed').remove()">
                        Fermer
                    </button>
                    <button class="text-xs px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600" 
                            onclick="uiService.addBookFromSearch('${book.id}'); this.closest('.fixed').remove();">
                        Ajouter
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(preview);
        
        preview.addEventListener('click', (e) => {
            if (e.target === preview) {
                preview.remove();
            }
        });
    }

    showSearchLoading(isLoading) {
        if (!this.elements.searchResults) return;
        
        if (isLoading) {
            this.elements.searchResults.innerHTML = `
                <div class="flex items-center justify-center py-8">
                    <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
                    <span class="ml-2 text-gray-600">Recherche en cours...</span>
                </div>
            `;
        }
    }

    clearSearchResults() {
        if (this.elements.searchResults) {
            this.elements.searchResults.innerHTML = '';
        }
    }

    resetAddBookForm() {
        if (this.elements.bookSearchInput) {
            this.elements.bookSearchInput.value = '';
        }
        this.clearSearchResults();
    }

    handleNavbarSearch(query) {
        const event = new CustomEvent('searchLibrary', {
            detail: { query }
        });
        document.dispatchEvent(event);
    }

    showLoading(isLoading, message = 'Chargement...') {
        if (!this.elements.loadingOverlay) return;
        
        if (isLoading) {
            const messageSpan = this.elements.loadingOverlay.querySelector('span');
            if (messageSpan) {
                messageSpan.textContent = message;
            }
            
            this.elements.loadingOverlay.classList.remove('hidden');
            this.state.isLoading = true;
        } else {
            this.elements.loadingOverlay.classList.add('hidden');
            this.state.isLoading = false;
        }
    }

    showMessage(message, type = 'info', duration = null) {
        const messageEl = this.createMessageElement(message, type);
        this.elements.messageContainer.appendChild(messageEl);
        
        setTimeout(() => {
            messageEl.classList.add('opacity-100', 'translate-x-0');
        }, 10);
        
        const hideTimeout = duration || this.config.messageTimeout;
        setTimeout(() => {
            this.hideMessage(messageEl);
        }, hideTimeout);
        
        const closeBtn = messageEl.querySelector('.close-message');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideMessage(messageEl));
        }
    }

    createMessageElement(message, type) {
        const typeConfig = {
            success: { bgColor: 'bg-green-500', icon: '✅', textColor: 'text-white' },
            error: { bgColor: 'bg-red-500', icon: '❌', textColor: 'text-white' },
            warning: { bgColor: 'bg-yellow-500', icon: '⚠️', textColor: 'text-white' },
            info: { bgColor: 'bg-blue-500', icon: 'ℹ️', textColor: 'text-white' }
        };
        
        const config = typeConfig[type] || typeConfig.info;
        
        const messageEl = document.createElement('div');
        messageEl.className = `
            ${config.bgColor} ${config.textColor} px-4 py-3 rounded-lg shadow-lg 
            transform translate-x-full opacity-0 transition-all duration-300 
            flex items-center space-x-3 min-w-[300px] max-w-md
        `;
        
        messageEl.innerHTML = `
            <span class="text-lg">${config.icon}</span>
            <span class="flex-1 text-sm font-medium">${message}</span>
            <button class="close-message text-lg hover:opacity-70 transition" aria-label="Fermer">
               ×
            </button>
       `;
       
       return messageEl;
   }

   hideMessage(messageEl) {
       messageEl.classList.add('translate-x-full', 'opacity-0');
       setTimeout(() => {
           if (messageEl.parentNode) {
               messageEl.parentNode.removeChild(messageEl);
           }
       }, 300);
   }

   handleKeyPress(e) {
       if (e.key === 'Escape') {
           this.closeActiveModal();
       }
       
       if (e.ctrlKey && e.key === 'n') {
           e.preventDefault();
           this.openAddBookModal();
       }
       
       if (e.ctrlKey && e.key === 'f') {
           e.preventDefault();
           if (this.elements.searchNavbar) {
               this.elements.searchNavbar.focus();
           }
       }
   }

   handleResize() {
       this.adjustModalSizes();
       this.updateAllColumnsState();
   }

   adjustModalSizes() {
       const modals = [this.elements.bookModal, this.elements.addBookModal];
       
       modals.forEach(modal => {
           if (modal && !modal.classList.contains('hidden')) {
               const modalContent = modal.querySelector('div > div');
               if (modalContent) {
                   if (window.innerWidth < 768) {
                       modalContent.classList.add('m-2');
                       modalContent.classList.remove('m-4');
                   } else {
                       modalContent.classList.add('m-4');
                       modalContent.classList.remove('m-2');
                   }
               }
           }
       });
   }

   updateAllColumnsState() {
       Object.values(this.elements.columns).forEach(column => {
           if (column) {
               this.updateEmptyColumnState(column);
           }
       });
   }

   initializeAnimations() {
       const observerOptions = {
           threshold: 0.1,
           rootMargin: '0px 0px -50px 0px'
       };
       
       this.intersectionObserver = new IntersectionObserver((entries) => {
           entries.forEach(entry => {
               if (entry.isIntersecting) {
                   entry.target.classList.add('animate-fade-in');
               }
           });
       }, observerOptions);
       
       this.observeBookCards();
   }

   observeBookCards() {
       const bookCards = document.querySelectorAll('.book-card');
       bookCards.forEach(card => {
           this.intersectionObserver.observe(card);
       });
   }

   addDragClasses(element) {
       element.classList.add('dragging');
       element.style.transform = 'rotate(5deg) scale(0.95)';
       element.style.opacity = '0.7';
   }

   removeDragClasses(element) {
       element.classList.remove('dragging');
       element.style.transform = '';
       element.style.opacity = '';
   }

   addDropHoverClass(column) {
       column.classList.add('drag-over');
       column.style.backgroundColor = '#dbeafe';
       column.style.borderColor = '#3b82f6';
       column.style.borderStyle = 'dashed';
       column.style.borderWidth = '2px';
   }

   removeDropHoverClass(column) {
       column.classList.remove('drag-over');
       column.style.backgroundColor = '';
       column.style.borderColor = '';
       column.style.borderStyle = '';
       column.style.borderWidth = '';
   }

   showSuccessAnimation(element, message = '✅') {
       const successIndicator = document.createElement('div');
       successIndicator.className = 'absolute inset-0 flex items-center justify-center bg-green-500 bg-opacity-90 rounded-lg text-white font-bold text-2xl z-10';
       successIndicator.textContent = message;
       
       element.style.position = 'relative';
       element.appendChild(successIndicator);
       
       successIndicator.style.opacity = '0';
       successIndicator.style.transform = 'scale(0.8)';
       
       setTimeout(() => {
           successIndicator.style.transition = 'all 0.3s ease';
           successIndicator.style.opacity = '1';
           successIndicator.style.transform = 'scale(1)';
       }, 10);
       
       setTimeout(() => {
           successIndicator.style.opacity = '0';
           successIndicator.style.transform = 'scale(1.2)';
           setTimeout(() => {
               if (successIndicator.parentNode) {
                   successIndicator.parentNode.removeChild(successIndicator);
               }
           }, 300);
       }, 1500);
   }

   showErrorAnimation(element, message = '❌') {
       element.style.animation = 'shake 0.5s ease-in-out';
       
       setTimeout(() => {
           element.style.animation = '';
       }, 500);
       
       this.showSuccessAnimation(element, message);
   }

   getUIStats() {
       return {
           activeModal: this.state.activeModal,
           isLoading: this.state.isLoading,
           cacheSize: this.intersectionObserver ? 'actif' : 'inactif',
           messagesCount: this.elements.messageContainer ? this.elements.messageContainer.children.length : 0
       };
   }

   cleanup() {
       if (this.state.searchTimeout) {
           clearTimeout(this.state.searchTimeout);
       }
       
       if (this.intersectionObserver) {
           this.intersectionObserver.disconnect();
       }
       
       document.removeEventListener('keydown', this.handleKeyPress);
       window.removeEventListener('resize', this.handleResize);
   }
}

const uiService = new UIService();
window.uiService = uiService;

if (typeof module !== 'undefined' && module.exports) {
   module.exports = UIService;
}