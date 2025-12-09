// Esperamos a que el contenido de la página cargue
document.addEventListener('DOMContentLoaded', function() {
    
    // Seleccionamos los elementos del menú
    const menuToggle = document.getElementById('menu-toggle');
    const navMenu = document.getElementById('nav-menu');

    // Añadimos el evento 'click' al icono de hamburguesa
    if(menuToggle && navMenu) {
        menuToggle.addEventListener('click', function() {
            // Alternamos la clase 'active' para mostrar/ocultar menú
            navMenu.classList.toggle('active');
        });
    }

    // Opcional: Cerrar menú al hacer clic en un enlace
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
        });
    });
});
