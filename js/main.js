// --- Código anterior de menú móvil ---
document.addEventListener('DOMContentLoaded', function() {
    const menuToggle = document.getElementById('menu-toggle');
    const navMenu = document.getElementById('nav-menu');

    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', function() {
            navMenu.classList.toggle('active');
        });
    }

    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
        });
    });

    // --- LÓGICA DEL CARRUSEL PRINCIPAL ---
    const slider = document.querySelector('.slider-container');
    const slides = document.querySelectorAll('.slide-item');
    const dotsContainer = document.getElementById('slider-dots');
    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');

    let currentSlide = 0;
    let autoSlideInterval;
    const totalSlides = slides.length;
    const slideDuration = 5000; // 5 segundos

    // Función principal para mover el slider
    function goToSlide(index) {
        if (index < 0) {
            index = totalSlides - 1;
        } else if (index >= totalSlides) {
            index = 0;
        }

        slider.style.transform = `translateX(-${index * 100 / totalSlides}%)`;
        
        // Actualizar indicadores (puntos)
        dotsContainer.querySelectorAll('.dot').forEach((dot, i) => {
            dot.classList.remove('active');
            if (i === index) {
                dot.classList.add('active');
            }
        });
        currentSlide = index;
    }

    // Inicializar el movimiento automático
    function startAutoSlide() {
        // Aseguramos que solo haya un intervalo corriendo
        if (autoSlideInterval) clearInterval(autoSlideInterval);
        
        autoSlideInterval = setInterval(() => {
            goToSlide(currentSlide + 1);
        }, slideDuration);
    }

    // --- Event Listeners ---

    // 1. Botones de Navegación
    prevBtn.addEventListener('click', () => {
        goToSlide(currentSlide - 1);
        startAutoSlide(); // Reinicia el contador al hacer clic
    });

    nextBtn.addEventListener('click', () => {
        goToSlide(currentSlide + 1);
        startAutoSlide(); // Reinicia el contador al hacer clic
    });

    // 2. Indicadores (puntos)
    dotsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('dot')) {
            const index = parseInt(e.target.dataset.index);
            goToSlide(index);
            startAutoSlide(); // Reinicia el contador al hacer clic
        }
    });

    // Iniciar al cargar la página
    startAutoSlide();
});
