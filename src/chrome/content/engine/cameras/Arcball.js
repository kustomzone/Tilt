/*
 * Arcball.js - Easy to use arcball controller for Tilt
 * version 0.1
 *
 * Copyright (c) 2011 Victor Porof
 *
 * This software is provided "as-is", without any express or implied
 * warranty. In no event will the authors be held liable for any damages
 * arising from the use of this software.
 *
 * Permission is granted to anyone to use this software for any purpose,
 * including commercial applications, and to alter it and redistribute it
 * freely, subject to the following restrictions:
 *
 *    1. The origin of this software must not be misrepresented; you must not
 *    claim that you wrote the original software. If you use this software
 *    in a product, an acknowledgment in the product documentation would be
 *    appreciated but is not required.
 *
 *    2. Altered source versions must be plainly marked as such, and must not
 *    be misrepresented as being the original software.
 *
 *    3. This notice may not be removed or altered from any source
 *    distribution.
 */
"use strict";

var Tilt = Tilt || {};
var EXPORTED_SYMBOLS = ["Tilt.Arcball"];

/**
 * Arcball constructor.
 * This is a general purpose 3D rotation controller described by Ken Shoemake
 * in the Graphics Interface ’92 Proceedings. It features good behavior
 * easy implementation, cheap execution. TODO: optional axis constrain.
 *
 * @param {Number} width: the width of canvas
 * @param {Number} height: the height of canvas
 * @param {Number} radius: optional, the radius of the arcball
 * @return {Tilt.Arcball} the newly created object
 */
Tilt.Arcball = function(width, height, radius) {

  /**
   * Values retaining the current horizontal and vertical mouse coordinates.
   */
  this.$mouseX = 0;
  this.$mouseY = 0;
  this.$oldMouseX = 0;
  this.$oldMouseY = 0;
  this.$newMouseX = 0;
  this.$newMouseY = 0;
  this.$mouseButton = -1;
  this.$scrollValue = 0;

  /**
   * Array retaining the current pressed key codes.
   */
  this.$keyCode = [];
  this.$keyCoded = false;

  /**
   * The vectors representing the mouse coordinates mapped on the arcball
   * and their perpendicular converted from (x, y) to (x, y, z) at specific
   * events like mousePressed and mouseDragged.
   */
  this.$startVec = vec3.create();
  this.$endVec = vec3.create();
  this.$pVec = vec3.create();

  /**
   * The corresponding rotation quaternions.
   */
  this.$lastRot = quat4.create([0, 0, 0, 1]);
  this.$deltaRot = quat4.create([0, 0, 0, 1]);
  this.$currentRot = quat4.create([0, 0, 0, 1]);
  
  /**
   * The current camera translation coordinates.
   */
  this.$lastPan = [0, 0];
  this.$currentPan = [0, 0];
  this.$currentTrans = vec3.create();

  /**
   * Additional rotation and translation vectors.
   */
  this.$addKeyRot = [0, 0];
  this.$addKeyTrans = [0, 0];

  // set the current dimensions of the arcball
  this.resize(width, height, radius);
};

Tilt.Arcball.prototype = {

  /**
   * Call this function whenever you need the updated rotation quaternion
   * and the zoom amount. These values will be returned as "rotation" & "zoom"
   * properties inside an object.
   *
   * @param {Number} frameDelta: optional, pass deltas for smooth animations
   * @return {Object} the rotation quaternion and the zoom amount
   */
  loop: function(frameDelta) {
    if ("undefined" === typeof frameDelta) {
      frameDelta = 0.25;
    } else {
      // this should be in the (0..1) interval
      frameDelta = Tilt.Math.clamp(frameDelta / 100, 0.01, 0.99);
    }

    // cache some variables for easier access
    var radius = this.$radius,
      width = this.$width,
      height = this.$height,

      oldMouseX = this.$oldMouseX,
      oldMouseY = this.$oldMouseY,
      newMouseX = this.$newMouseX,
      newMouseY = this.$newMouseY,
      mouseButton = this.$mouseButton,
      scrollValue = this.$scrollValue,

      keyCode = this.$keyCode,
      keyCoded = this.$keyCoded,

      startVec = this.$startVec,
      endVec = this.$endVec,
      pVec = this.$pVec,

      lastRot = this.$lastRot,
      deltaRot = this.$deltaRot,
      currentRot = this.$currentRot,

      lastPan = this.$lastPan,
      currentPan = this.$currentPan,
      currentTrans = this.$currentTrans,

      addKeyRot = this.$addKeyRot,
      addKeyTrans = this.$addKeyTrans;

    // smoothly update the mouse coordinates
    this.$mouseX += (newMouseX - this.$mouseX) * frameDelta;
    this.$mouseY += (newMouseY - this.$mouseY) * frameDelta;

    // left mouse button handles rotation
    if (mouseButton === 1) {
      var mouseX = this.$mouseX, mouseY = this.$mouseY;

      // find the sphere coordinates of the mouse positions
      this.pointToSphere(mouseX, mouseY, width, height, radius, endVec);

      // compute the vector perpendicular to the start & end vectors
      vec3.cross(startVec, endVec, pVec);

      // if the begin and end vectors don't coincide
      if (vec3.length(pVec) > 0) {
        deltaRot[0] = pVec[0];
        deltaRot[1] = pVec[1];
        deltaRot[2] = pVec[2];

        // in the quaternion values, w is cosine (theta / 2),
        // where theta is the rotation angle
        deltaRot[3] = -vec3.dot(startVec, endVec);
      } else {
        // return an identity rotation quaternion
        deltaRot[0] = 0;
        deltaRot[1] = 0;
        deltaRot[2] = 0;
        deltaRot[3] = 1;
      }

      // calculate the current rotation based on the mouse click events
      quat4.multiply(lastRot, deltaRot, currentRot);
    }
    else {
      quat4.set(currentRot, lastRot);
    }

    // right mouse button handles panning
    if (mouseButton === 3) {
      currentPan[0] = lastPan[0] + (newMouseX - oldMouseX);
      currentPan[1] = lastPan[1] + (newMouseY - oldMouseY);
    }
    else {
      lastPan[0] = currentPan[0];
      lastPan[1] = currentPan[1];
    }

    // handle additional rotation and translation by the keyboard
    if (keyCode[65]) { // w
      addKeyRot[1] -= frameDelta / 1000;
    }
    if (keyCode[68]) { // s
      addKeyRot[1] += frameDelta / 1000;
    }
    if (keyCode[87]) { // a
      addKeyRot[0] += frameDelta / 1000;
    }
    if (keyCode[83]) { // d
      addKeyRot[0] -= frameDelta / 1000;
    }
    if (keyCode[37]) { // left
      addKeyTrans[0] += frameDelta * 50;
    }
    if (keyCode[39]) { // right
      addKeyTrans[0] -= frameDelta * 50;
    }
    if (keyCode[38]) { // up
      addKeyTrans[1] += frameDelta * 50;
    }
    if (keyCode[40]) { // down
      addKeyTrans[1] -= frameDelta * 50;
    }

    // create an additional rotation based on the key events
    Tilt.Math.quat4fromEuler(addKeyRot[1], addKeyRot[0], 0, deltaRot);
    quat4.multiply(currentRot, deltaRot);

    // create an additional translation based on the key events
    currentTrans[0] = currentPan[0] + addKeyTrans[0];
    currentTrans[1] = currentPan[1] + addKeyTrans[1];

    // update the zoom based on the mouse scroll
    currentTrans[2] += (scrollValue - currentTrans[2]) / 10;

    // return the current rotation and translation
    return {
      rotation: currentRot,
      translation: currentTrans
    };
  },

  /**
   * Function handling the mousePressed event.
   * Call this when the mouse was pressed.
   *
   * @param {Number} x: the current horizontal coordinate of the mouse
   * @param {Number} y: the current vertical coordinate of the mouse
   * @param {Number} button: which mouse button was pressed
   */
  mousePressed: function(x, y, button) {
    this.$mouseX = x;
    this.$mouseY = y;
    this.$mouseButton = button;
    this.$save();
  },

  /**
   * Function handling the mouseReleased event.
   * Call this when a mouse button was released.
   *
   * @param {Number} x: the current horizontal coordinate of the mouse
   * @param {Number} y: the current vertical coordinate of the mouse
   */
  mouseReleased: function(x, y) {
    this.$mouseButton = -1;
  },

  /**
   * Function handling the mouseMoved event.
   * Call this when the mouse was moved.
   *
   * @param {Number} x: the current horizontal coordinate of the mouse
   * @param {Number} y: the current vertical coordinate of the mouse
   */
  mouseMoved: function(x, y) {
    this.$newMouseX = x;
    this.$newMouseY = y;
  },

  /**
   * Function handling the mouseScroll event.
   * Call this when the mouse wheel was scrolled.
   *
   * @param {Number} scroll: the mouse wheel direction and speed
   */
  mouseScroll: function(scroll) {
    this.$scrollValue -= scroll * 10;
  },

  /**
   * Function handling the keyPressed event.
   * Call this when the a key was pressed.
   *
   * @param {Number} code: the code corresponding to the key pressed
   */
  keyPressed: function(code) {
    this.$keyCode[code] = true;
    
    if (code === 17 || code === 224) {
      this.$keyCoded = true;
    }
  },

  /**
   * Function handling the keyReleased event.
   * Call this when the a key was released.
   *
   * @param {Number} code: the code corresponding to the key released
   */
  keyReleased: function(code) {
    this.$keyCode[code] = false;

    if (code === 17 || code === 224) {
      this.$keyCoded = false;
    }
  },

  /**
   * Maps the 2d coordinates of the mouse location to a 3d point on a sphere.
   *
   * @param {Number} x: the current horizontal coordinate of the mouse
   * @param {Number} y: the current vertical coordinate of the mouse
   * @param {Number} width: the width of canvas
   * @param {Number} height: the height of canvas
   * @param {Number} radius: optional, the radius of the arcball
   * @param {Array} sphereVec: a 3d vector to store the sphere coordinates
   */
  pointToSphere: function(x, y, width, height, radius, sphereVec) {
    // adjust point coords and scale down to range of [-1..1]
    x = (x - width / 2) / radius;
    y = (y - height / 2) / radius;

    // compute the square length of the vector to the point from the center
    var sqlength = x * x + y * y,
      normal = 0;

    // if the point is mapped outside of the sphere
    if (sqlength > 1) {
      // calculate the normalization factor
      normal = 1 / Math.sqrt(sqlength);

      // set the normalized vector (a point on the sphere)
      sphereVec[0] = x * normal;
      sphereVec[1] = y * normal;
      sphereVec[2] = 0;
    } else {
      // set the vector to a point mapped inside the sphere
      sphereVec[0] = x;
      sphereVec[1] = y;
      sphereVec[2] = Math.sqrt(1 - sqlength);
    }
  },

  /**
   * Resize this implementation to use different bounds.
   * This function is automatically called when the arcball is created.
   *
   * @param {Number} width: the width of canvas
   * @param {Number} height: the height of canvas
   * @param {Number} radius: optional, the radius of the arcball
   */
  resize: function(newWidth, newHeight, newRadius) {
    // set the new width, height and radius dimensions
    this.$width = newWidth;
    this.$height = newHeight;
    this.$radius = "undefined" !== typeof newRadius ? newRadius : newHeight;
    this.$save();
  },

  /**
   * Saves the current arcball state, typically after mouse or resize events.
   */
  $save: function() {
    var radius = this.$radius,
      width = this.$width,
      height = this.$height,
      mouseX = this.$mouseX,
      mouseY = this.$mouseY,
      addKeyRot = this.$addKeyRot;

    this.$oldMouseX = mouseX;
    this.$oldMouseY = mouseY;
    this.$newMouseX = mouseX;
    this.$newMouseY = mouseY;

    this.pointToSphere(mouseX, mouseY, width, height, radius, this.$startVec);
    quat4.set(this.$currentRot, this.$lastRot);

    addKeyRot[0] = 0;
    addKeyRot[1] = 0;
  },

  /**
   * Destroys this object and deletes all members.
   */
  destroy: function() {
    for (var i in this) {
      delete this[i];
    }
  }
};
