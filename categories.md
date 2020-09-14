---
layout: page
title: Categories
description: "Recipes by Category"
permalink: /categories.html
---

{% assign categories = site.recipes
		| map: 'categories'
		| join: ","
		| split: ","
		| sort %}

<ul class="entry-meta">
	{% for category in categories %}
		<li><a href="#{{ category }}" class="tag"><span class="term">{{ category }}</span></a></li>
	{% endfor %}
</ul>

{% for category in categories %}
<h3>{{ category }}</h3>
<ul>
	{% for recipe in site.recipes %}
		{% if recipe.categories contains category %}
			<li><a href="{{ recipe.url | relative_url }}">{{ recipe.title}}</a></li>
		{% endif %}
	{% endfor %}
</ul>
{% endfor %}
