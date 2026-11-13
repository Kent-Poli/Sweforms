document.querySelectorAll('.product-gallery').forEach(gallery => {
  const mainImage = gallery.querySelector('.product-gallery-main img');
  const caption = gallery.querySelector('figcaption');
  const thumbnails = gallery.querySelectorAll('.product-gallery-thumbnails a');

  thumbnails.forEach(thumbnail => {
    thumbnail.addEventListener('click', event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();

      const preview = thumbnail.querySelector('img');
      mainImage.src = thumbnail.href;
      mainImage.alt = preview.alt;
      mainImage.setAttribute('width', preview.getAttribute('width'));
      mainImage.setAttribute('height', preview.getAttribute('height'));
      caption.textContent = thumbnail.querySelector('span').textContent;

      gallery.querySelector('[aria-current="true"]').removeAttribute('aria-current');
      thumbnail.setAttribute('aria-current', 'true');
    });
  });
});
