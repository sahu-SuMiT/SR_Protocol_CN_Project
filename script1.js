// Three.js setup
let scene, camera, renderer, controls;
let senderNode, receiverNode;
let packets = [];
let windowSize, timeout, packetLossRate, numPackets;
let currentWindow = [];
let baseSeqNum = 0;
let nextSeqNum = 0;
let simulationRunning = false;
let simulationPaused = false;
let animationSpeed = 5; // Default animation speed

// Initialize Three.js scene
function init() {
    scene = new THREE.Scene();

    // Create a more attractive background with gradient
    const backgroundColor = new THREE.Color(0x2c3e50);
    scene.background = backgroundColor;

    // Add fog for depth effect
    scene.fog = new THREE.Fog(backgroundColor, 20, 40);

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({ antialias: true });

    const container = document.getElementById('canvas-container');
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Add orbit controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Enhanced lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 1, 1);
    scene.add(directionalLight);

    // Add point lights for better visual appeal
    const pointLight1 = new THREE.PointLight(0x4CAF50, 0.5);
    pointLight1.position.set(-10, 5, 5);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0x2196F3, 0.5);
    pointLight2.position.set(10, 5, 5);
    scene.add(pointLight2);

    // Create nodes
    createNodes();

    // Position camera
    camera.position.z = 15;
    camera.position.y = 0;

    // Start animation loop
    animate();
}

// Create sender and receiver nodes
function createNodes() {
    // Remove existing labels if they exist
    const existingLabels = scene.children.filter(child =>
        child instanceof THREE.Sprite &&
        (child.userData.isLabel === 'sender' || child.userData.isLabel === 'receiver')
    );
    existingLabels.forEach(label => scene.remove(label));

    // Calculate pole height based on number of packets
    const poleHeight = Math.max(8, numPackets * 1.5); // Adjusted height calculation

    // Create vertical columns for sender and receiver
    const columnGeometry = new THREE.BoxGeometry(1, poleHeight, 1);
    const senderMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const receiverMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });

    senderNode = new THREE.Mesh(columnGeometry, senderMaterial);
    receiverNode = new THREE.Mesh(columnGeometry, receiverMaterial);

    senderNode.position.x = -8;
    receiverNode.position.x = 8;

    scene.add(senderNode);
    scene.add(receiverNode);

    // Add labels
    addNodeLabels(poleHeight);
}

// Add text labels to nodes
function addNodeLabels(poleHeight) {
    const createTextSprite = (text, isLabel) => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 1024;
        canvas.height = 512;

        context.fillStyle = 'white';
        context.font = 'Bold 160px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        context.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            opacity: 1,
            depthTest: false,
            depthWrite: false
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.scale.set(6, 3, 1);
        sprite.renderOrder = 999;
        sprite.userData.isLabel = isLabel; // Add identifier for label type
        return sprite;
    };

    // Position labels at the top of poles
    const senderLabel = createTextSprite('SENDER', 'sender');
    senderLabel.position.set(-8, poleHeight / 2 + 3, 0);
    scene.add(senderLabel);

    const receiverLabel = createTextSprite('RECEIVER', 'receiver');
    receiverLabel.position.set(8, poleHeight / 2 + 3, 0);
    scene.add(receiverLabel);
}

// Create text sprite for frame numbers and status
function createTextSprite(text, scale = 1, isStatus = false) {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 1024;
    canvas.height = 512;

    // Draw background only for frame numbers, not for status
    if (!isStatus) {
        // Set font first to measure text width accurately
        context.font = 'Bold 160px Arial';
        const textWidth = context.measureText(text).width;

        // Make background box fit text exactly with some padding
        const padding = 20;
        const boxWidth = textWidth + padding * 2;
        const boxHeight = 120;

        // Center the box
        const boxX = (canvas.width - boxWidth) / 2;
        const boxY = (canvas.height - boxHeight) / 2;

        // Draw black background with rounded corners
        context.fillStyle = 'black';
        context.beginPath();
        context.roundRect(boxX, boxY, boxWidth, boxHeight, 10);
        context.fill();

        // Add a white border
        context.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        context.lineWidth = 2;
        context.stroke();
    }

    // Draw text
    context.fillStyle = 'white';
    context.font = isStatus ? 'Bold 140px Arial' : 'Bold 160px Arial'; // Reduced font size for status
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 1,
        depthTest: false,
        depthWrite: false
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(scale * 2, scale, 1); // Adjusted scale for better fit
    sprite.renderOrder = 999;
    return sprite;
}

// Create a packet mesh
function createPacket(seqNum) {
    // Create a line for the packet path with slanting angle
    const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
    const points = [];

    // Calculate pole height and starting position
    const poleHeight = Math.max(8, numPackets * 1.5);
    const topY = poleHeight / 2 - 1; // Start from top of pole

    // Adjust starting and ending positions while maintaining slope
    const startY = topY - (seqNum * 0.8); // Reduced spacing between packets from 1.5 to 0.8
    const endY = startY - 2; // Maintain same slope by keeping 2 units difference

    points.push(new THREE.Vector3(-8, startY, 0));
    points.push(new THREE.Vector3(8, endY, 0));

    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(lineGeometry, lineMaterial);
    scene.add(line);

    // Create the packet
    const geometry = new THREE.BoxGeometry(0.5, 0.2, 0.2);
    const material = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const packet = new THREE.Mesh(geometry, material);
    packet.userData.seqNum = seqNum;
    packet.userData.line = line;
    packet.userData.startY = startY;
    packet.userData.endY = endY;
    packet.userData.fullLine = points;

    // Add frame number label directly in 3D space with adjusted scale
    const frameLabel = createTextSprite(`F${seqNum}`, 2);
    frameLabel.position.set(-8, startY, 0.5);
    scene.add(frameLabel);
    packet.userData.frameLabel = frameLabel;

    return packet;
}

// Update status display
function updateStatus(message, isSimulationStart = false) {
    const statusDiv = document.getElementById('status');
    const statusMessage = document.createElement('div');
    statusMessage.textContent = message;
    statusMessage.style.padding = '5px';
    statusMessage.style.borderBottom = '1px solid #ccc';

    if (isSimulationStart) {
        // Insert simulation start message at the top
        statusDiv.insertBefore(statusMessage, statusDiv.firstChild);
        statusMessage.classList.add('simulation-start');
    } else {
        // Add other messages below
        statusDiv.appendChild(statusMessage);
    }
    statusDiv.scrollTop = statusDiv.scrollHeight;
}

function updateCurrentStatus(packet, status) {
    const statusList = document.querySelector('.status-list');
    const statusDiv = document.createElement('div');
    statusDiv.textContent = `Packet F${packet.userData.seqNum}: ${status}`;
    if (status === 'lost') {
        statusDiv.classList.add('error');
    }
    statusList.appendChild(statusDiv);

    // Keep only the last N status messages where N is the number of packets being sent
    while (statusList.children.length > numPackets) {
        statusList.removeChild(statusList.firstChild);
    }
}

function updatePacketLabels(seqNum, status) {
    const senderLabels = document.getElementById('senderLabels');
    const receiverLabels = document.getElementById('receiverLabels');

    // Update sender label
    let senderLabel = document.getElementById(`sender-F${seqNum}`);
    if (!senderLabel && status === 'sending') {
        senderLabel = document.createElement('div');
        senderLabel.id = `sender-F${seqNum}`;
        senderLabel.className = 'packet-label';
        senderLabel.textContent = `F${seqNum}`;
        senderLabels.appendChild(senderLabel);
    }

    // Update receiver label
    if (status === 'received' || status === 'lost') {
        let receiverLabel = document.createElement('div');
        receiverLabel.id = `receiver-F${seqNum}`;
        receiverLabel.className = `packet-label ${status}`;
        receiverLabel.textContent = `F${seqNum} (${status})`;
        receiverLabels.appendChild(receiverLabel);

        // Remove sender label
        if (senderLabel) {
            senderLabel.remove();
        }
    }
}

// Animate packets
function animatePackets() {
    if (simulationPaused) return;

    packets.forEach((packet) => {
        if (packet.userData.moving) {
            const progress = packet.userData.progress;

            // Calculate current position
            packet.position.x = -8 + (16 * progress);
            packet.position.y = packet.userData.startY +
                (packet.userData.endY - packet.userData.startY) * progress;

            if (!packet.userData.lost) {
                // Use animation speed to control packet movement
                const speedFactor = animationSpeed / 5; // Convert speed to a multiplier
                packet.userData.progress += 0.005 * speedFactor;
            }

            if (packet.userData.progress >= 1) {
                packet.userData.moving = false;
                handlePacketArrival(packet);
            }
        }
    });
}

// Handle packet arrival
function handlePacketArrival(packet) {
    const seqNum = packet.userData.seqNum;
    const retryCount = packet.userData.retryCount || 0;
    const maxRetries = 3;

    if (Math.random() * 100 < packetLossRate && retryCount < maxRetries) {
        packet.userData.lost = true;
        updateStatus(`Packet F${seqNum} lost! (Attempt ${retryCount + 1}/${maxRetries + 1})`);
        updateCurrentStatus(packet, 'lost');

        // Calculate midpoint for X mark
        const progress = 0.5;
        const midX = -8 + (16 * progress);
        const midY = packet.userData.startY +
            (packet.userData.endY - packet.userData.startY) * progress;

        // Create red X mark
        const crossMaterial = new THREE.LineBasicMaterial({ color: 0xff0000 });
        const crossGeometry1 = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(midX - 0.3, midY + 0.3, 0),
            new THREE.Vector3(midX + 0.3, midY - 0.3, 0)
        ]);
        const crossGeometry2 = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(midX - 0.3, midY - 0.3, 0),
            new THREE.Vector3(midX + 0.3, midY + 0.3, 0)
        ]);

        const cross1 = new THREE.Line(crossGeometry1, crossMaterial);
        const cross2 = new THREE.Line(crossGeometry2, crossMaterial);
        scene.add(cross1);
        scene.add(cross2);

        // Update line to stop at X mark and make it red
        const newPoints = [
            new THREE.Vector3(-8, packet.userData.startY, 0),
            new THREE.Vector3(midX, midY, 0)
        ];
        packet.userData.line.geometry.setFromPoints(newPoints);
        packet.userData.line.material.color.setHex(0xff0000);

        // Make packet red
        packet.material.color.setHex(0xff0000);

        // Add status label at receiver with larger text
        const statusLabel = createTextSprite(`F${seqNum} (Lost)`, 2.5, true);
        statusLabel.position.set(12, packet.userData.endY, 0.5); // Moved further right
        statusLabel.material.color.setHex(0xff0000);
        scene.add(statusLabel);
        packet.userData.statusLabel = statusLabel;

        setTimeout(() => {
            scene.remove(packet);
            scene.remove(packet.userData.line);
            scene.remove(packet.userData.frameLabel);
            scene.remove(packet.userData.statusLabel);
            scene.remove(cross1);
            scene.remove(cross2);
            packets = packets.filter(p => p !== packet);
            retransmitPacket(seqNum, retryCount + 1);
        }, timeout);
    } else if (retryCount >= maxRetries) {
        updateStatus(`Packet F${seqNum} failed permanently after ${maxRetries + 1} attempts`);
        updateCurrentStatus(packet, 'failed');

        // Add failed status label at receiver with larger text
        const statusLabel = createTextSprite(`F${seqNum} (Failed)`, 2.5, true);
        statusLabel.position.set(12, packet.userData.endY, 0.5); // Moved further right
        statusLabel.material.color.setHex(0xff0000);
        scene.add(statusLabel);
        packet.userData.statusLabel = statusLabel;

        setTimeout(() => {
            scene.remove(packet);
            scene.remove(packet.userData.line);
            scene.remove(packet.userData.frameLabel);
            scene.remove(packet.userData.statusLabel);
            packets = packets.filter(p => p !== packet);
            handleAcknowledgment(seqNum);
        }, timeout);
    } else {
        updateStatus(`Packet F${seqNum} received successfully${retryCount > 0 ? ` (after ${retryCount + 1} attempts)` : ''}`);
        updateCurrentStatus(packet, 'received');

        // Add success status label at receiver with adjusted position and scale
        const statusLabel = createTextSprite(`F${seqNum} (Received)`, 2.5, true); // Reduced scale
        // Adjust position based on packet number to prevent overlap
        const xOffset = seqNum >= 10 ? 22 : 18; // Increased offset for double-digit numbers
        statusLabel.position.set(xOffset, packet.userData.endY, 0.5);
        statusLabel.material.color.setHex(0x00ff00);
        scene.add(statusLabel);
        packet.userData.statusLabel = statusLabel;

        // Fade out the line and packet
        const fadeDuration = 500;
        const startTime = Date.now();

        function fadeOut() {
            const elapsed = Date.now() - startTime;
            const progress = elapsed / fadeDuration;

            if (progress < 1) {
                const opacity = 1 - progress;
                packet.userData.line.material.opacity = opacity;
                packet.material.opacity = opacity;
                packet.userData.frameLabel.material.opacity = opacity;
                packet.userData.statusLabel.material.opacity = opacity;
                requestAnimationFrame(fadeOut);
            } else {
                scene.remove(packet.userData.line);
                scene.remove(packet);
                scene.remove(packet.userData.frameLabel);
                scene.remove(packet.userData.statusLabel);
                packets = packets.filter(p => p !== packet);
                handleAcknowledgment(seqNum);
            }
        }

        // Make materials transparent
        packet.userData.line.material.transparent = true;
        packet.material.transparent = true;
        packet.userData.frameLabel.material.transparent = true;
        packet.userData.statusLabel.material.transparent = true;

        fadeOut();
    }
}

// Retransmit a lost packet
function retransmitPacket(seqNum, retryCount) {
    const packet = createPacket(seqNum);
    packet.position.copy(senderNode.position);
    packet.userData.moving = true;
    packet.userData.progress = 0;
    packet.userData.retryCount = retryCount;
    scene.add(packet);
    packets.push(packet);
}

