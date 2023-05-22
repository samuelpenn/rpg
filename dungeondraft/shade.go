package main

import (
    "flag"
    "image"
    "image/color"
    "image/png"
    "os"
)

func shadeImageFile(inFile string, outFile string, red int, green int, blue int) {
    file, _ := os.OpenFile(inFile, os.O_RDONLY, 0644)
    srcImage, _, _ := image.Decode(file)
    file.Close()
    
    width := srcImage.Bounds().Size().X
    height := srcImage.Bounds().Size().Y
    
    upperLeft := image.Point{0,0}
    lowerRight := image.Point{ width, height}

    destImage := image.NewRGBA(image.Rectangle{upperLeft, lowerRight})
    
    for py := 0; py < height; py++ {
        for px := 0; px < width; px++ {
            r, g, b, a := srcImage.At(px, py).RGBA()

            colour := color.RGBA{uint8(r/256), uint8(g/256), uint8(b/256), uint8(a)}
            if (r > 0 && g < r/5 && b < r/5) {
                scale := float64(float64(r) / 65536.0)
                r = uint32(float64(red) * scale)
                g = uint32(float64(green) * scale)
                b = uint32(float64(blue) * scale)
                colour = color.RGBA{uint8(r), uint8(g), uint8(b), uint8(a)}
            }

            destImage.Set(px, py, colour)
        }
    }

    f, _ := os.OpenFile(outFile, os.O_CREATE | os.O_WRONLY, 0644)
    _ = png.Encode(f, destImage)
    f.Close()

}

func main() {
    flag_red := flag.Int("r", 64, "Red colour")
    flag_green := flag.Int("g", 64, "Green colour")
    flag_blue := flag.Int("b", 64, "Blue colour")
    flag_inFile := flag.String("i", "", "Input file")
    flag_outFile := flag.String("o", "", "Output file")

    flag.Parse()
    
    shadeImageFile(*flag_inFile, *flag_outFile, *flag_red, *flag_green, *flag_blue)    
}



