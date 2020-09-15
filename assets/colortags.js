// Based on https://gist.github.com/0x263b/2bdd90886c2036a1ad5bcf06d6e6fb37

const toPastel = str => {
	str = str.toLowerCase();
	let hash = 0;
	if (str.length === 0) return hash;
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
		hash = hash & hash;
	}
	return `hsl(${hash % 360},70%,70%)`;
}

(function () {
	document.querySelectorAll(".colortag").forEach(tag => {
		tag.style.backgroundColor = toPastel(tag.textContent);
	})
})();
