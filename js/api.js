class ApiService {
    constructor() {
        this.baseUrl = 'https://www.googleapis.com/books/v1/volumes';
        this.apiKey = window.CONFIG ? window.CONFIG.GOOGLE_BOOKS_API_KEY : '';
        
        this.defaultParams = {
            maxResults: 12,
            printType: 'books',
            orderBy: 'relevance'
        };
        
        this.cache = new Map();
        this.cacheExpiry = 5 * 60 * 1000;
    }

    async searchBooks(query, options = {}) {
        try {
            if (!query || query.trim().length < 2) {
                throw new Error('La recherche doit contenir au moins 2 caractères');
            }

            const searchQuery = query.trim();

            const cacheKey = `search_${searchQuery}_${JSON.stringify(options)}`;
            const cachedResult = this.getFromCache(cacheKey);
            if (cachedResult) {
                return cachedResult;
            }

            const searchUrl = this.buildSearchUrl(searchQuery, options);
            this.showLoadingState(true);

            const response = await fetch(searchUrl);
            
            if (!response.ok) {
                throw new Error(`Erreur API: ${response.status} - ${response.statusText}`);
            }

            const data = await response.json();
            const books = this.formatSearchResults(data);
            
            this.setCache(cacheKey, books);
            
            return books;

        } catch (error) {
            this.handleApiError(error);
            return [];
        } finally {
            this.showLoadingState(false);
        }
    }

    async getBookDetails(bookId) {
        try {
            if (!bookId) {
                throw new Error('ID du livre requis');
            }

            const cacheKey = `details_${bookId}`;
            const cachedResult = this.getFromCache(cacheKey);
            if (cachedResult) {
                return cachedResult;
            }

            let detailsUrl = `${this.baseUrl}/${bookId}`;
            if (this.apiKey) {
                detailsUrl += `?key=${this.apiKey}`;
            }

            const response = await fetch(detailsUrl);
            
            if (!response.ok) {
                throw new Error(`Erreur récupération détails: ${response.status}`);
            }

            const data = await response.json();
            const bookDetails = this.formatBookDetails(data);
            
            this.setCache(cacheKey, bookDetails);
            return bookDetails;

        } catch (error) {
            this.handleApiError(error);
            return null;
        }
    }

    buildSearchUrl(query, options = {}) {
        const params = { ...this.defaultParams, ...options };
        const encodedQuery = encodeURIComponent(query);
        
        const urlParams = new URLSearchParams();
        urlParams.append('q', encodedQuery);
        
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                urlParams.append(key, params[key]);
            }
        });
        
        if (this.apiKey) {
            urlParams.append('key', this.apiKey);
        }
        
        return `${this.baseUrl}?${urlParams.toString()}`;
    }

    formatSearchResults(apiResponse) {
        if (!apiResponse.items || !Array.isArray(apiResponse.items)) {
            return [];
        }

        return apiResponse.items.map(item => this.formatBookData(item));
    }

    formatBookData(bookItem) {
        const volumeInfo = bookItem.volumeInfo || {};
        const imageLinks = volumeInfo.imageLinks || {};
        
        return {
            id: bookItem.id,
            title: volumeInfo.title || 'Titre non disponible',
            authors: volumeInfo.authors || ['Auteur inconnu'],
            publisher: volumeInfo.publisher || 'Éditeur inconnu',
            publishedDate: volumeInfo.publishedDate || 'Date inconnue',
            
            description: this.cleanDescription(volumeInfo.description || 'Description non disponible'),
            
            thumbnail: imageLinks.thumbnail || imageLinks.smallThumbnail || this.getPlaceholderImage(),
            cover: imageLinks.large || imageLinks.medium || imageLinks.thumbnail || this.getPlaceholderImage(),
            
            pageCount: volumeInfo.pageCount || 0,
            categories: volumeInfo.categories || ['Non classé'],
            language: volumeInfo.language || 'fr',
            isbn: this.extractISBN(volumeInfo.industryIdentifiers || []),
            
            status: 'to-read',
            rating: 0,
            comment: '',
            progress: 0,
            dateAdded: new Date().toISOString(),
            dateStatusChanged: new Date().toISOString(),
            
            source: 'google-books',
            apiData: bookItem
        };
    }

    formatBookDetails(bookData) {
        const formatted = this.formatBookData(bookData);
        const volumeInfo = bookData.volumeInfo || {};
        
        return {
            ...formatted,
            subtitle: volumeInfo.subtitle || '',
            averageRating: volumeInfo.averageRating || 0,
            ratingsCount: volumeInfo.ratingsCount || 0,
            maturityRating: volumeInfo.maturityRating || 'NOT_MATURE',
            
            previewLink: volumeInfo.previewLink || '',
            infoLink: volumeInfo.infoLink || '',
            canonicalVolumeLink: volumeInfo.canonicalVolumeLink || ''
        };
    }

    cleanDescription(description) {
        if (!description) return 'Description non disponible';
        
        const cleanText = description.replace(/<[^>]*>/g, '');
        const maxLength = 300;
        
        if (cleanText.length > maxLength) {
            return cleanText.substring(0, maxLength) + '...';
        }
        
        return cleanText;
    }

    extractISBN(identifiers) {
        const isbnTypes = ['ISBN_13', 'ISBN_10'];
        
        for (const type of isbnTypes) {
            const isbn = identifiers.find(id => id.type === type);
            if (isbn) {
                return isbn.identifier;
            }
        }
        
        return '';
    }

    getPlaceholderImage() {
        return 'assets/images/placeholder.jpg';
    }

    setCache(key, data) {
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }

    getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        if (Date.now() - cached.timestamp > this.cacheExpiry) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.data;
    }

    cleanExpiredCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.cacheExpiry) {
                this.cache.delete(key);
            }
        }
    }

    handleApiError(error) {
        let errorMessage = 'Une erreur est survenue lors de la recherche';
        
        if (error.message.includes('429')) {
            errorMessage = 'Trop de requêtes. Veuillez attendre quelques instants.';
        } else if (error.message.includes('403')) {
            errorMessage = 'Accès refusé à l\'API. Vérifiez votre clé API.';
        } else if (error.message.includes('404')) {
            errorMessage = 'Livre non trouvé.';
        } else if (!navigator.onLine) {
            errorMessage = 'Pas de connexion internet.';
        }
        
        this.showErrorMessage(errorMessage);
    }

    showLoadingState(isLoading) {
        if (window.uiService) {
            window.uiService.showLoading(isLoading);
        }
    }

    showErrorMessage(message) {
        if (window.uiService) {
            window.uiService.showMessage(message, 'error');
        }
    }

    getApiStats() {
        return {
            cacheSize: this.cache.size,
            lastCleanup: new Date().toLocaleString('fr-FR')
        };
    }
}

const apiService = new ApiService();

setInterval(() => {
    apiService.cleanExpiredCache();
}, 10 * 60 * 1000);

window.apiService = apiService;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiService;
}