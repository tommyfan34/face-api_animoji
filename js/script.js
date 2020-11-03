(function () {
  // Set our main variables
  let scene,
  renderer,
  camera,
  canvasInput = document.createElement('canvas'),
  model, // Our character
  neck, // Reference to the neck bone in the skeleton
  waist, // Reference to the waist bone in the skeleton
  possibleAnims, // Animations found in our file
  mixer, // THREE.js animations mixer
  idle, // Idle, the default state our character returns to
  clock = new THREE.Clock(), // Used for anims, which run to a clock instead of frame rate 
  currentlyAnimating = false, // Used to check whether characters neck is being used in another anim
  raycaster = new THREE.Raycaster(), // Used to detect the click on our character
  loaderAnim = document.getElementById('js-loader'),
  faceRotate = new CustomEvent("face_rotate", {'detail':{
	  tilt_x: 0,  // face tilt in x axis
	  tilt_y: 0   // face tilt in y axis
  }}),
  control_mode = false; // control the input method for model rotation, false is mouse move while true is face 

  async function load_faceapi(){
	  await faceapi.nets.tinyFaceDetector.loadFromUri('./weights');
	  await faceapi.loadFaceLandmarkModel('./weights');
  }

  init();
  function init() {
	  load_faceapi();
	  
    const MODEL_PATH = './rat.glb';
    const canvas = document.querySelector('#c');
    const backgroundColor = 0xf1f1f1;

    // Init the scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    scene.fog = new THREE.Fog(backgroundColor, 60, 100);

    // Init the renderer
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.setPixelRatio(window.devicePixelRatio);
    document.body.appendChild(renderer.domElement);

    // Add a camera
    camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    1000);

    camera.position.z = 30;
    camera.position.x = 0;
    camera.position.y = -3;

    // load the model
    var loader = new THREE.GLTFLoader();

    loader.load(
    MODEL_PATH,
    function (gltf) {
      model = gltf.scene;
      let fileAnimations = gltf.animations;

      model.traverse(o => {

        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
        }
        // Reference the neck and waist bones
        if (o.isBone && o.name === 'mixamorigNeck') {
          neck = o;
        }
        if (o.isBone && o.name === 'mixamorigSpine') {
          waist = o;
        }
      });

      model.scale.set(7, 7, 7);
      model.position.y = -11;

      scene.add(model);

      // remove the loading animation on the canvas
      loaderAnim.remove();

      mixer = new THREE.AnimationMixer(model);

      let clips = fileAnimations.filter(val => val.name !== 'idle');
      possibleAnims = clips.map(val => {
        let clip = THREE.AnimationClip.findByName(clips, val.name);

        clip.tracks.splice(3, 3);
        clip.tracks.splice(9, 3);

        clip = mixer.clipAction(clip);
        return clip;
      });


      let idleAnim = THREE.AnimationClip.findByName(fileAnimations, 'idle');
      // remove the waist and neck track from idleAnim to prevent it from overwritting the cursor-following anim
      idleAnim.tracks.splice(3, 3);
      idleAnim.tracks.splice(9, 3);
	  console.log(idleAnim.tracks);
      idle = mixer.clipAction(idleAnim);
      idle.play();

    },
    undefined, // We don't need this function
    function (error) {
      console.error(error);
    });


    // Add lights
    let hemiLight = new THREE.HemisphereLight(0xffffff, 0xffffff, 0.61);
    hemiLight.position.set(0, 50, 0);
    // Add hemisphere light to scene
    scene.add(hemiLight);

    let d = 8.25;
    let dirLight = new THREE.DirectionalLight(0xffffff, 0.54);
    dirLight.position.set(-8, 12, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize = new THREE.Vector2(1024, 1024);
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 1500;
    dirLight.shadow.camera.left = d * -1;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = d * -1;
    // Add directional Light to scene
    scene.add(dirLight);


    // Floor
    let floorGeometry = new THREE.PlaneGeometry(5000, 5000, 1, 1);
    let floorMaterial = new THREE.MeshPhongMaterial({
      color: 0xeeeeee,
      shininess: 0 });


    let floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -0.5 * Math.PI;
    floor.receiveShadow = true;
    floor.position.y = -11;
    scene.add(floor);

    let geometry = new THREE.SphereGeometry(8, 32, 32);
    let material = new THREE.MeshBasicMaterial({ color: 0x9bffaf }); // 0xf2ce2e 
    let sphere = new THREE.Mesh(geometry, material);

    sphere.position.z = -15;
    sphere.position.y = -2.5;
    sphere.position.x = -0.25;
	
	// request the camera permission and get the video stream
	navigator.mediaDevices.getUserMedia({video:true})
	.then(stream => {
		const video = document.createElement('video');
		let toggle_button = document.createElement('button');
		let anim_button = document.createElement('button');
		toggle_button.innerHTML = '鼠标控制';
		anim_button.innerHTML = '随机播放动画';
		toggle_button.style.position = 'fixed';
		anim_button.style.position = 'fixed';
		toggle_button.style.bottom = '200px';
		anim_button.style.bottom = '150px';
		toggle_button.style.right = '140px';
		anim_button.style.right = '140px';
		toggle_button.style.width = '150px';
		anim_button.style.width = '150px';
		toggle_button.style.height = '50px';
		anim_button.style.height = '50px';
		toggle_button.onclick = function(){
			control_mode = !control_mode;
			if(control_mode){
				toggle_button.innerHTML = "头部控制";
			}else{
				toggle_button.innerHTML = "鼠标控制";
			}
		};
		anim_button.onclick = function(){
			if(!currentlyAnimating){
				currentlyAnimating = true;
				playOnClick();
			}
		};
		video.srcObject = stream;
		video.style.position = 'fixed';
		video.style.top = '25px';
		video.style.right = '20px';
		video.width = 400;
		video.height = 300;
		canvasInput.style.position = 'fixed';
		canvasInput.style.top = '25px';
		canvasInput.style.right = '20px';
		canvasInput.width = 400;
		canvasInput.height = 300;
		video.play();
		document.body.appendChild(video);
		document.body.appendChild(canvasInput);
		document.body.appendChild(toggle_button);
		document.body.appendChild(anim_button);
		return new Promise(r => video.onloadedmetadata = _ => r(video));
	})
	.then(video => {
		update_face();
	})
	.catch(console.error);
  }

  update();

  function update() {
    if (mixer) {
      mixer.update(clock.getDelta());
    }

    if (resizeRendererToDisplaySize(renderer)) {
      const canvas = renderer.domElement;
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
    }

    renderer.render(scene, camera);
    requestAnimationFrame(update);
  }

  function isFaceDetectionModelLoaded(){
	  return !!faceapi.nets.tinyFaceDetector.params;
  }

  let cc = canvasInput.getContext('2d');
  let inputSize = 224;
  let scoreThreshold = 0.5;
  async function update_face(){
	  const videoE1 = document.getElementsByTagName('video')[0];
	  const options = new faceapi.TinyFaceDetectorOptions({inputSize, scoreThreshold});
	  if(isFaceDetectionModelLoaded()){
		  const detect_result = await faceapi.detectSingleFace(videoE1, options).withFaceLandmarks();
		  if(!detect_result){
			  requestAnimationFrame(update_face);
		  }
		  const resizedResult = faceapi.resizeResults(detect_result, {width: 400, height: 300});
		  cc.clearRect(0, 0, canvasInput.width, canvasInput.height);
		  faceapi.draw.drawDetections(canvasInput, resizedResult);
		  faceapi.draw.drawFaceLandmarks(canvasInput, resizedResult);
		  let center = detect_result.landmarks.getNose()[3];
		  let left = detect_result.landmarks.getJawOutline()[2];
		  let right = detect_result.landmarks.getJawOutline()[14];
		  let bottom = detect_result.landmarks.getJawOutline()[8];
		  faceRotate.detail.tilt_x = ((center.x - left.x) - (right.x - center.x))/3;
		  faceRotate.detail.tilt_y = -(left.y - bottom.y + 100);
		  faceRotate.detail.tilt_y = faceRotate.detail.tilt_y < 0 ? faceRotate.detail.tilt_y / 2 : faceRotate.detail.tilt_y;
		  console.log(faceRotate.detail.tilt_y);
		  document.dispatchEvent(faceRotate);
	  }  
	  requestAnimationFrame(update_face);
  }

  function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let canvasPixelWidth = canvas.width / window.devicePixelRatio;
    let canvasPixelHeight = canvas.height / window.devicePixelRatio;

    const needResize =
    canvasPixelWidth !== width || canvasPixelHeight !== height;
    if (needResize) {
      renderer.setSize(width, height, false);
    }
    return needResize;
  }

  // click event for PC
  // window.addEventListener('click', e => raycast(e));
  // tap event for touch screen
  // window.addEventListener('touchend', e => raycast(e, true)); 

  function raycast(e, touch = false) {
    var mouse = {};
    if (touch) {
      mouse.x = 2 * (e.changedTouches[0].clientX / window.innerWidth) - 1;
      mouse.y = 1 - 2 * (e.changedTouches[0].clientY / window.innerHeight);
    } else {
      mouse.x = 2 * (e.clientX / window.innerWidth) - 1;
      mouse.y = 1 - 2 * (e.clientY / window.innerHeight);
    }
    // update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // calculate objects intersecting the picking ray
    var intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects[0]) {
		if (!currentlyAnimating) {
		  currentlyAnimating = true;
		  playOnClick();
		}
    }
  }

  // Get a random animation, and play it 
  function playOnClick() {
    let anim = Math.floor(Math.random() * possibleAnims.length) + 0;
    playModifierAnimation(idle, 0.25, possibleAnims[anim], 0.25);
  }


  function playModifierAnimation(from, fSpeed, to, tSpeed) {
    to.setLoop(THREE.LoopOnce);
    to.reset();
    to.play();
    from.crossFadeTo(to, fSpeed, true);
    setTimeout(function () {
      from.enabled = true;
      to.crossFadeTo(from, tSpeed, true);
      currentlyAnimating = false;
    }, to._clip.duration * 1000 - (tSpeed + fSpeed) * 1000);
  }

  // add mouse move event
  document.addEventListener('mousemove', function (e) {
    var mousecoords = getMousePos(e);
    if (neck && waist && !control_mode) {
      moveJoint(mousecoords, neck, 50);
      moveJoint(mousecoords, waist, 30);
    }
  });

  // add face rotate event
  document.addEventListener('face_rotate',function(e){
	  if(control_mode){
		  let neck_limit = 50;
		  let waist_limit = 30;
		  neck.rotation.y = THREE.Math.degToRad(Math.abs(e.detail.tilt_x) < neck_limit ? e.detail.tilt_x : (e.detail.tilt_x < 0 ? -neck_limit : neck_limit));
		  neck.rotation.x = THREE.Math.degToRad(Math.abs(e.detail.tilt_y) < neck_limit ? e.detail.tilt_y : (e.detail.tilt_y < 0 ? -neck_limit : neck_limit));
		  waist.rotation.y = THREE.Math.degToRad(Math.abs(e.detail.tilt_x) < waist_limit ? e.detail.tilt_x : (e.detail.tilt_x < 0 ? -waist_limit : waist_limit));
		  waist.rotation.x = THREE.Math.degToRad(Math.abs(e.detail.tilt_y) < waist_limit ? e.detail.tilt_y : (e.detail.tilt_y < 0 ? -waist_limit : waist_limit));
	  }	  
  });

  function getMousePos(e) {
    return { x: e.clientX, y: e.clientY };
  }

  function moveJoint(mouse, joint, degreeLimit) {
    let degrees = getMouseDegrees(mouse.x, mouse.y, degreeLimit);
    joint.rotation.y = THREE.Math.degToRad(degrees.x);
    joint.rotation.x = THREE.Math.degToRad(degrees.y);
    // console.log(joint.rotation.x);
  }

  function getMouseDegrees(x, y, degreeLimit) {
    let dx = 0,
    dy = 0,
    xdiff,
    xPercentage,
    ydiff,
    yPercentage;

    let w = { x: window.innerWidth, y: window.innerHeight };

    // Left (Rotates neck left between 0 and -degreeLimit)
    // 1. If cursor is in the left half of screen
    if (x <= w.x / 2) {
      // 2. Get the difference between middle of screen and cursor position
      xdiff = w.x / 2 - x;
      // 3. Find the percentage of that difference (percentage toward edge of screen)
      xPercentage = xdiff / (w.x / 2) * 100;
      // 4. Convert that to a percentage of the maximum rotation we allow for the neck
      dx = degreeLimit * xPercentage / 100 * -1;
    }

    // Right (Rotates neck right between 0 and degreeLimit)
    if (x >= w.x / 2) {
      xdiff = x - w.x / 2;
      xPercentage = xdiff / (w.x / 2) * 100;
      dx = degreeLimit * xPercentage / 100;
    }
    // Up (Rotates neck up between 0 and -degreeLimit)
    if (y <= w.y / 2) {
      ydiff = w.y / 2 - y;
      yPercentage = ydiff / (w.y / 2) * 100;
      // Note that I cut degreeLimit in half when she looks up
      dy = degreeLimit * 0.5 * yPercentage / 100 * -1;
    }
    // Down (Rotates neck down between 0 and degreeLimit)
    if (y >= w.y / 2) {
      ydiff = y - w.y / 2;
      yPercentage = ydiff / (w.y / 2) * 100;
      dy = degreeLimit * yPercentage / 100;
    }
    return { x: dx, y: dy };
  }

})();