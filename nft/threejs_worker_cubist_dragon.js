function isMobile() {
    return /Android|mobile|iPad|iPhone/i.test(navigator.userAgent);
}

const interpolationFactor = 24;

let trackedMatrix = {
    // for interpolation
    delta: [
        0,0,0,0,
        0,0,0,0,
        0,0,0,0,
        0,0,0,0
    ],
    interpolated: [
        0,0,0,0,
        0,0,0,0,
        0,0,0,0,
        0,0,0,0
    ]
}

let markers = {
    "cubist": {
        width: 2160,
        height: 1520,
        dpi: 600,
        url: "../../dataNFT/cubist-dragon",
    },
};

<!-- image https://www.kalwaltart.com/assets/images/uploads/cubist_dragon.jpg-->
var videoScene = document.createElement('video');
videoScene.muted = true
videoScene.src = '../resources/data/video/cubic-dragon-background01e.mp4';
// video.play()
videoScene.autoplay = true;
window.videoScene = videoScene

var texture = new THREE.VideoTexture( videoScene );
texture.minFilter = THREE.LinearFilter;
texture.magFilter = THREE.LinearFilter;
texture.format = THREE.RGBFormat;

var setMatrix = function (matrix, value) {
    let array = [];
    for (let key in value) {
        array[key] = value[key];
    }
    if (typeof matrix.elements.set === "function") {
        matrix.elements.set(array);
    } else {
        matrix.elements = [].slice.call(array);
    }
};

function start(container, marker, video, input_width, input_height, canvas_draw, render_update, track_update) {
    let vw, vh;
    let sw, sh;
    let pscale, sscale;
    let w, h;
    let pw, ph;
    let ox, oy;
    let worker;
    let camera_para = '../../../resources/data/camera_para-iPhone 5 rear 640x480 1.0m.dat'

    let canvas_process = document.createElement('canvas');
    let context_process = canvas_process.getContext('2d');

    // let context_draw = canvas_draw.getContext('2d');
    let renderer = new THREE.WebGLRenderer({ canvas: canvas_draw, alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);

    let scene = new THREE.Scene();

    let camera = new THREE.Camera();
    camera.matrixAutoUpdate = false;
    scene.add(camera);

    let root = new THREE.Object3D();
    scene.add(root);

  	var mat = new THREE.MeshBasicMaterial({map: texture, side: THREE.DoubleSide});
    //var planeGeom = new THREE.PlaneGeometry(120,90);
    var planeGeom = new THREE.PlaneGeometry(1,1,1,1);
    var plane = new THREE.Mesh(planeGeom, mat);
  	plane.position.x = 90;
  	plane.position.y = 65;
  	plane.scale.set(180,130,1);


    root.matrixAutoUpdate = false;
    root.add(plane);

    let load = () => {
        vw = input_width;
        vh = input_height;

        pscale = 320 / Math.max(vw, vh / 3 * 4);
        sscale = isMobile() ? window.outerWidth / input_width : 1;

        sw = vw * sscale;
        sh = vh * sscale;
        video.style.width = sw + "px";
        video.style.height = sh + "px";
        container.style.width = sw + "px";
        container.style.height = sh + "px";
        canvas_draw.style.clientWidth = sw + "px";
        canvas_draw.style.clientHeight = sh + "px";
        canvas_draw.width = sw;
        canvas_draw.height = sh;
        w = vw * pscale;
        h = vh * pscale;
        pw = Math.max(w, h / 3 * 4);
        ph = Math.max(h, w / 4 * 3);
        ox = (pw - w) / 2;
        oy = (ph - h) / 2;
        canvas_process.style.clientWidth = pw + "px";
        canvas_process.style.clientHeight = ph + "px";
        canvas_process.width = pw;
        canvas_process.height = ph;

        renderer.setSize(sw, sh);

        worker = new Worker('../resources/jsartoolkit5/artoolkit/artoolkit.worker.js');

        worker.postMessage({ type: "load", pw: pw, ph: ph, camera_para: camera_para, marker: marker.url });

        worker.onmessage = (ev) => {
            let msg = ev.data;
            switch (msg.type) {
                case "loaded": {
                    let proj = JSON.parse(msg.proj);
                    let ratioW = pw / w;
                    let ratioH = ph / h;
                    proj[0] *= ratioW;
                    proj[4] *= ratioW;
                    proj[8] *= ratioW;
                    proj[12] *= ratioW;
                    proj[1] *= ratioH;
                    proj[5] *= ratioH;
                    proj[9] *= ratioH;
                    proj[13] *= ratioH;
                    setMatrix(camera.projectionMatrix, proj);
                    break;
                }
                case "endLoading":{
                    if(msg.end == true)
                    // removing loader page if present
                    document.body.classList.remove( 'loading' );
                    document.getElementById('loading').remove();
                    break;
                }
                case "found": {
                    found(msg);
                    break;
                }
                case "not found": {
                    found(null);
                    break;
                }
            }
            track_update();
            process();
        };
    };

    var world;

    var found = ( msg ) => {
        if( !msg ) {
            world = null;
        } else {
            world = JSON.parse( msg.matrixGL_RH );
        }
    };

    let lasttime = Date.now();
    let time = 0;

    let draw = () => {
        render_update();
        
        if (!world) {
            plane.visible = false;
        } else {
            plane.visible = true;
            console.log('Video play');
            videoScene.play();
            videoScene.muted = false;

            // interpolate matrix
            for( let i = 0; i < 16; i++ ) {
               trackedMatrix.delta[i] = world[i] - trackedMatrix.interpolated[i];
               trackedMatrix.interpolated[i] = trackedMatrix.interpolated[i] + ( trackedMatrix.delta[i] / interpolationFactor );
             }

            setMatrix( root.matrix, trackedMatrix.interpolated );

        }
        renderer.render(scene, camera);
    };

    function process() {
        context_process.fillStyle = "black";
        context_process.fillRect(0, 0, pw, ph);
        context_process.drawImage(video, 0, 0, vw, vh, ox, oy, w, h);

        let imageData = context_process.getImageData(0, 0, pw, ph);
        worker.postMessage({ type: "process", imagedata: imageData }, [imageData.data.buffer]);
    }
    let tick = () => {
        draw();
        requestAnimationFrame(tick);
    };

    load();
    tick();
    process();
}
