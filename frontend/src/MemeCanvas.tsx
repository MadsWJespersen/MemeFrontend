import React from "react";
import { useEffect, useState } from "react";
import { MemeCanvasState, useMemeCanvasState } from './State';

export const MemeCanvas :React.FC<{memeState:MemeCanvasState,className:string}> = (props) =>{
    var fontBase = 1000,                   // selected default width for canvas
    fontSize = 100;                     // default size for font

    function getFont(width:number) {
        var ratio = fontSize / fontBase;   // calc ratio
        var size = width * ratio;   // get font size based on current width
        return (size|0) + 'px Impact'; // set font
    }

    function drawText(ctx:CanvasRenderingContext2D,text:string,centerX:number,centerY:number,font:string){
        ctx.save();
        ctx.font = font;
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.fillStyle = "white";
        ctx.strokeStyle='black';
        ctx.fillText(text,centerX,centerY);
        ctx.strokeText(text,centerX,centerY)
        ctx.restore();
    }

    function getWindowDimensions() {
        const { innerWidth: width, innerHeight: height } = window;
        return {
          width,
          height
        };
    }

    function useWindowDimensions() {
        const [windowDimensions, setWindowDimensions] = useState(getWindowDimensions());

        useEffect(() => {
          function handleResize() {
            setWindowDimensions(getWindowDimensions());
          }
      
          window.addEventListener('resize', handleResize);
          return () => window.removeEventListener('resize', handleResize);
        }, []);

        return windowDimensions;
    }


    const windowDimensions = useWindowDimensions();
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        var imageElement = new Image();
        imageElement.src = props.memeState.visualFileURL
        imageElement.addEventListener('load', () => {
            var memeCanvas = canvasRef.current;
            if(memeCanvas){
                const ctx = memeCanvas.getContext('2d') 
                if (ctx){
                    

                    let maxDimension = windowDimensions.width < 400 ? windowDimensions.width - 50 : 400;
                    
                    if (imageElement.width > maxDimension && imageElement.width >= imageElement.height){
                        memeCanvas.width = maxDimension;
                        memeCanvas.height = maxDimension * (imageElement.height/imageElement.width);
                    }else if (imageElement.height > maxDimension && imageElement.height > imageElement.width){
                        memeCanvas.height = maxDimension;
                        memeCanvas.width = maxDimension * (imageElement.width/imageElement.height);
                    }else {
                        memeCanvas.width = imageElement.width;
                        memeCanvas.height = imageElement.height;
                    }
                   
                    var scale = Math.min(memeCanvas.width / imageElement.width, memeCanvas.height / imageElement.height);
                    // get the top left position of the image
                    var x = (memeCanvas.width / 2) - (imageElement.width / 2) * scale;
                    var y = (memeCanvas.height / 2) - (imageElement.height / 2) * scale;
                    ctx.drawImage(imageElement, x, y, imageElement.width * scale, imageElement.height * scale);
                    let font = getFont(memeCanvas.width);

                    drawText(ctx,props.memeState.toptext,memeCanvas.width/2, memeCanvas.height/8,font);
                    drawText(ctx,props.memeState.bottomtext,memeCanvas.width/2, memeCanvas.height - memeCanvas.height/8,font);                   
                }
            }
        })
    });

    return(
        <div className={props.className}>
            <div className="Meme-canvas-container">
                <canvas ref={canvasRef}/>
            </div>
            {props.children}
        </div>
    );
}