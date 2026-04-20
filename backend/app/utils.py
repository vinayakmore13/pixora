import qrcode
import qrcode.image.svg
import io

def generate_qr_svg(data: str) -> str:
    factory = qrcode.image.svg.SvgPathImage
    img = qrcode.make(data, image_factory=factory, box_size=10)
    
    output = io.BytesIO()
    img.save(output)
    svg_content = output.getvalue().decode('utf-8')
    
    # Clean up the SVG to be embedded (remove xml declaration etc)
    start_idx = svg_content.find('<svg')
    if start_idx != -1:
        return svg_content[start_idx:]
    return svg_content
