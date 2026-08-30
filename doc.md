# Map Base

Geo Text

- Geo text are just text elements you can place anywhere on the map. They are same as normal text elements you can have on whiteboard base. Each geo text's text content is editable by doing double click (on desktop) as well as on mobile view, you can click on pencil icon on bottom right to edit text content.
- You can make geo text zoom resistant as well as turn of zoom resistant property for them. By default each geo text element is zoom resistant, meaning they scale as you would zoom in/out of the map such that they are visible from distant. When you turn off zoom resistant for text, they remain fixed constant size text component whether you zoom in or out.

Point

- Point has a circle and text attached to it. While editing text properties for point is limited, they are always zoom resistant. Because point act as pin, by default the text and point circle will always be zoom resistant , meaning they would be able to stand out and scale when you zoom in/out of the map and will be visible from distant on map.

Route

- As name suggests , route help you draw polygon based line with ability to select the edge points by placing them and hence route will automatically be drawn on the map. You can draw zig-zag route by repeatedly creating points in "N" shape and it will be painted exactly like that.
- The polygon will be unclosed unlike area component.

Area

- Area lets you draw closed line polygon which has same controls as route, just that the area is calculated at the end after you've finished placing edge points on map for your expected area.
