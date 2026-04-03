document.getElementById('speedSlider').addEventListener('input', function() {
  document.getElementById('speedLabel').textContent = this.value + 'ms';
});

init();
