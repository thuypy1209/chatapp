document.addEventListener("DOMContentLoaded", function() {
    const sky = document.querySelector('.starry-sky');
    if (!sky) return;

    const starSymbols = ['✦', '✧'];
    const numberOfStars = 25; // Số lượng ngôi sao

    for (let i = 0; i < numberOfStars; i++) {
        const star = document.createElement('span');
        star.classList.add('random-star');
        
        star.innerText = starSymbols[Math.floor(Math.random() * starSymbols.length)];
        star.style.left = Math.random() * 98 + 'vw';
        star.style.top = Math.random() * 90 + '%';
        star.style.fontSize = (Math.random() * 10 + 12) + 'px'; // Kích thước từ 12px đến 22px
        star.style.animationDelay = (Math.random() * 2) + 's';
        star.style.color = Math.random() > 0.4 ? '#ffffff' : '#fef08a'; // Trắng hoặc Vàng nhạt Pastel

        sky.appendChild(star);
    }
});