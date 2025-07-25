class App {
    constructor() {
        this.services = {
            storage: null,
            api: null,
            ui: null,
            books: null
        };
        
        this.isInitialized = false;
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(() => this.init(), 100);
            });
        } else {
            setTimeout(() => this.init(), 100);
        }
    }

    async init() {
        try {
            await this.waitForServices();
            
            this.checkDependencies();
            this.initializeServices();
            this.setupGlobalEventListeners();
            this.loadInitialData();
            this.setupErrorHandling();
            
            this.isInitialized = true;
            
            this.showWelcomeMessage();
        } catch (error) {
            this.handleInitializationError(error);
        }
    }

    async waitForServices() {
        const maxAttempts = 50;
        let attempts = 0;
        
        while (attempts < maxAttempts) {
            if (window.storageService && window.apiService && window.uiService && window.bookManager) {
                return;
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
        }
        
        throw new Error('Timeout: Services non chargés dans les temps');
    }

    checkDependencies() {
        const required = [
            { name: 'storageService', object: window.storageService },
            { name: 'apiService', object: window.apiService },
            { name: 'uiService', object: window.uiService },
            { name: 'bookManager', object: window.bookManager }
        ];
        
        const missing = required.filter(service => !service.object);
        
        if (missing.length > 0) {
            throw new Error(`Services manquants: ${missing.map(s => s.name).join(', ')}`);
        }
        
        if (!window.CONFIG) {

        }
    }

    initializeServices() {
        this.services.storage = window.storageService;
        this.services.api = window.apiService;
        this.services.ui = window.uiService;
        this.services.books = window.bookManager;
    }

    setupGlobalEventListeners() {
        window.addEventListener('beforeunload', () => {
            this.cleanup();
        });
        
        window.addEventListener('online', () => {
            this.services.ui.showMessage('Connexion internet rétablie', 'success');
        });
        
        window.addEventListener('offline', () => {
            this.services.ui.showMessage('Connexion internet perdue', 'warning');
        });
        
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.handleAppResume();
            }
        });
    }

    loadInitialData() {
        const stats = this.services.storage.getStats();
        
        if (stats && stats.totalBooks === 0) {
            this.showFirstTimeUserExperience();
        }
    }

    setupErrorHandling() {
        window.addEventListener('error', (event) => {
            this.services.ui.showMessage('Une erreur inattendue s\'est produite', 'error');
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            event.preventDefault();
        });
    }

    showWelcomeMessage() {
        const stats = this.services.storage.getStats();
        if (stats && stats.totalBooks > 0) {
            this.services.ui.showMessage(
                `Bienvenue ! Vous avez ${stats.totalBooks} livre(s) dans votre bibliothèque`, 
                'info'
            );
        }
    }

    showFirstTimeUserExperience() {
        setTimeout(() => {
            this.services.ui.showMessage(
                'Bienvenue ! Cliquez sur "Ajouter un livre" pour commencer votre bibliothèque', 
                'info', 
                8000
            );
        }, 1000);
    }

    handleAppResume() {
        if (this.isInitialized) {
            this.services.books.loadMyBooks();
        }
    }

    handleInitializationError(error) {
        document.body.innerHTML = `
            <div class="min-h-screen flex items-center justify-center bg-gray-50">
                <div class="max-w-md w-full bg-white rounded-lg shadow p-6 text-center">
                    <div class="text-red-500 text-6xl mb-4">❌</div>
                    <h1 class="text-xl font-bold text-gray-900 mb-2">Erreur d'initialisation</h1>
                    <p class="text-gray-600 mb-4">${error.message}</p>
                    <button onclick="location.reload()" 
                            class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">
                        Recharger la page
                    </button>
                </div>
            </div>
        `;
    }

    getAppInfo() {
        return {
            isInitialized: this.isInitialized,
            services: Object.keys(this.services).map(key => ({
                name: key,
                loaded: !!this.services[key]
            })),
            stats: this.services.storage ? this.services.storage.getStats() : null,
            version: '1.0.0'
        };
    }

    cleanup() {
        if (this.services.books) {
            this.services.books.cleanup();
        }
        if (this.services.ui) {
            this.services.ui.cleanup();
        }
    }
}

const app = new App();
window.app = app;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = App;
}