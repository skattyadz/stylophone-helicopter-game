/* Author: Skattyadz
   Detection methods heavily inspired by http://phenomnomnominal.github.com/docs/tuner.html
*/

var Detection = function() {
  Detection.prototype.startDetection = function() {
    this.audioContext = new AudioContext();
    var audioContext = this.audioContext;
    
    var sampleRate = audioContext.sampleRate;
    this.fftSize = 8192;
    var fftSize = this.fftSize;
    this.fft = new FFT(fftSize, sampleRate / 4);
    var fft = this.fft;
    this.buffer = [];
    var buffer = this.buffer;
    

    _.times(fftSize, function() {
      buffer.push(0);
    });
    
    var bufferFillSize = 2048;
    var bufferFiller = audioContext.createJavaScriptNode(bufferFillSize, 1, 1);

    bufferFiller.onaudioprocess = function(e) {
      var input = e.inputBuffer.getChannelData(0);

      for (var b = bufferFillSize; b < fftSize; b++) {
        buffer[b - bufferFillSize] = buffer[b];
      }
      for (var b = 0; b < input.length; b++) {
        buffer[buffer.length - bufferFillSize + b] = input[b];
      }
    }
    
    gauss = new WindowFunction(DSP.GAUSS);
    
    lp = audioContext.createBiquadFilter();
    lp.type = lp.LOWPASS;
    lp.frequency = 8000;
    lp.Q = 0.1;
    
    hp = audioContext.createBiquadFilter();
    hp.type = hp.HIGHPASS;
    hp.frequency = 20;
    hp.Q = 0.1;
    
    var that = this;
    var success = function(stream) {
      // var display, getPitch, maxPeaks, maxTime, noiseCount, process, render, src;
      that.noiseCount = 0;
      that.maxTime = 0
      that.noiseThreshold = -Infinity
      that.maxPeaks = 0
      that.maxPeakCount = 0
      // try {
        var src = audioContext.createMediaStreamSource(stream);
        src.connect(lp);
        lp.connect(hp);
        hp.connect(bufferFiller);
        bufferFiller.connect(audioContext.destination);
        
        that.intervalID = setInterval(function() { that.processBuffer(); }, 100);
      // } catch (e) {
        // error(e);
      // }
    };
    error = function(e) {
      console.log(e);
      console.log('ARE YOU USING CHROME CANARY (23/09/2012) ON A MAC WITH "Web Audio Input" ENABLED IN chrome://flags?');
      return alert('ERROR: CHECK ERROR CONSOLE');
    };
    
    navigator.getUserMedia({
      audio: true
    }, success, error);
  }
  
  Detection.prototype.processBuffer = function() {
    var buffer = this.buffer;
    var fft = this.fft;
    var audioContext = this.audioContext;
    var sampleRate = this.audioContext.sampleRate;
    var fftSize = this.fftSize;
    
    bufferCopy = buffer.slice(0);
    gauss.process(bufferCopy);

    downsampled = [];
    for (var i = 0; i < fftSize; i += 4) {
      downsampled.push(bufferCopy[i]);
      downsampled.push(0);
      downsampled.push(0);
      downsampled.push(0);
    }
    fft.forward(downsampled);

    if (this.noiseCount < 10) {
      this.noiseThreshold = _.reduce(fft.spectrum, function(max, next) {
        return next > max ? next : max;
      }, this.noiseThreshold);
      this.noiseThreshold = this.noiseThreshold > 0.001 ? 0.001 : this.noiseThreshold;
      this.noiseCount++;
    }
    spectrumPoints = (function() {
      var _k, _ref1, _results;
      _results = [];
      for (x = _k = 0, _ref1 = fft.spectrum.length / 4; 0 <= _ref1 ? _k < _ref1 : _k > _ref1; x = 0 <= _ref1 ? ++_k : --_k) {
        _results.push({
          x: x,
          y: fft.spectrum[x]
        });
      }
      return _results;
    })();
    spectrumPoints.sort(function(a, b) {
      return b.y - a.y;
    });
    peaks = [];
    for (p = _k = 0; _k < 8; p = ++_k) {
      if (spectrumPoints[p].y > this.noiseThreshold * 5) {
        peaks.push(spectrumPoints[p]);
      }
    }
    if (peaks.length > 0) {
      for (var i=0; i < peaks.length; i++) {
        if (!peaks[i]) continue;
        
        for (var j=0; j < peaks.length; j++) {
          if (peaks[j] && i != j) {
            if (Math.abs(peaks[i].x - peaks[j].x) < 5) {
              peaks[j] = null;
            }
          }
        };
      };

      peaks = _.filter(peaks, function(peak){ return peak; });
      
      peaks.sort(function(a, b) {
        return a.x - b.x;
      });
      
      this.maxPeaks = this.maxPeaks < peaks.length ? peaks.length : this.maxPeaks;
      if (this.maxPeaks > 0) {
        this.maxPeakCount = 0;
      }
      peak = null;
      firstFreq = peaks[0].x * (sampleRate / fftSize);
      if (peaks.length > 1) {
        secondFreq = peaks[1].x * (sampleRate / fftSize);
        if ((1.4 < (_ref3 = firstFreq / secondFreq) && _ref3 < 1.6)) {
          peak = peaks[1];
        }
      }
      if (peaks.length > 2) {
        thirdFreq = peaks[2].x * (sampleRate / fftSize);
        if ((1.4 < (_ref4 = firstFreq / thirdFreq) && _ref4 < 1.6)) {
          peak = peaks[2];
        }
      }
      if (peaks.length > 1 || this.maxPeaks === 1) {
        if (!(peak != null)) {
          peak = peaks[0];
        }
        left = {
          x: peak.x - 1,
          y: Math.log(fft.spectrum[peak.x - 1])
        };
        peak = {
          x: peak.x,
          y: Math.log(fft.spectrum[peak.x])
        };
        right = {
          x: peak.x + 1,
          y: Math.log(fft.spectrum[peak.x + 1])
        };
        interp = 0.5 * ((left.y - right.y) / (left.y - (2 * peak.y) + right.y)) + peak.x;
        freq = interp * (sampleRate / fftSize);
        
        console.log('freq from 1 is: '+Math.floor(freq));
        updateHeliPosition(noteForFrequency(freq));
        // display.draw(note, diff);
      }
    }
  };
  return this;
};

var frequencies = {
  284:   1,
  301:   1.5,
  320:   2,
  339:   3,
  360:   3.5,
  380:   4,
  403:   4.5,
  426:  1
};

var activeFrequencies = frequencies;

function noteForFrequency(freq) {
  var diff, key, minDiff, note, val;
    // minDiff = Infinity;
    minDiff = 10;
    
    diff = Infinity;
    for (key in frequencies) {
      val = key;
      // console.log(Math.abs(freq - val));
      if (Math.abs(freq - val) < minDiff) {
        minDiff = Math.abs(freq - val);
        diff = freq - val;
        note = frequencies[key];;
      }
    }
    return note;
}

function checkSupport() {
  window.AudioContext = (window.AudioContext ||
    window.mozAudioContext ||
    window.webkitAudioContext ||
    window.msAudioContext ||
    window.oAudioContext);
  
  navigator.getUserMedia = (navigator.getUserMedia ||
    navigator.mozGetUserMedia ||
    navigator.webkitGetUserMedia ||
    navigator.msGetUserMedia ||
    navigator.oGetUserMedia);
    
  if (!window.AudioContext || !navigator.getUserMedia) {
    alert('This requires google Chrome, with "Web Audio Input" enabled chrome://flags.');
  }
}