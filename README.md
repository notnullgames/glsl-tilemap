# glsl-tilemap

This project is to explore ideas from [here](http://blog.tojicode.com/2012/07/sprite-tile-maps-on-gpu.html) and [here](https://blog.tojicode.com/2012/08/more-gpu-tile-map-demos-zelda.html). I want to keep it all web-only initially, so it can be used easily in other systems.

You can see the current version [here](https://notnullgames.github.io/glsl-tilemap/).

I am going to work in a few passes:

1. porting the demos directly to more modern JS techniques (ESM instead of requirejs)
2. converting [tiled](https://www.mapeditor.org/) (and maybe more) maps into images that can be used with this technique
3. making a playable 2d game using mostly 3d shaders (that can be more easily ported to different backends)

