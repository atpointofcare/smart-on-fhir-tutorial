(function(window){
  window.extractData = function() {
    var ret = $.Deferred();

    function onError() {
      console.log('Loading error', arguments);
      ret.reject();
    }

    function onReady(smart)  {
      if (smart.hasOwnProperty('patient')) {
        var patient = smart.patient;
        var pt = patient.read();
        var obv = smart.patient.api.fetchAll({
                    type: 'Observation',
                    query: {
                      code: {
                        $or: [
                              'http://loinc.org|8302-2', // height
                              'http://loinc.org|8462-4', // diastolic
                              'http://loinc.org|8480-6', // systolic
                              'http://loinc.org|2085-9', // hdl cholesterol
                              'http://loinc.org|2089-1', // ldl cholesterol
                              'http://loinc.org|55284-4' // blood pressure dia/sys
                              ]
                      }
                    }
                  });

        $.when(pt, obv).fail(onError);

        $.when(pt, obv).done(function(patient, obv) {
          var byCodes = smart.byCodes(obv, 'code');


          // DATA


          var ehr_patient_id = patient.id;
          var patient_email = 'No Email';
          var first_name = '';
          var last_name = '';
          var gender = patient.gender;
          var dob = patient.birthDate;
          var zipcode = patient.address[0].postalCode;

          if (typeof patient.name[0] !== 'undefined') {
            first_name = patient.name[0].given.join(' ');
            last_name = patient.name[0].family.join(' ');

            var telecomLength = patient.telecom.length;

            for (var i = 0; i < telecomLength; i++){

              if (patient.telecom[i].system == "email"){
                patient_email = patient.telecom[i].value;
              }
            }
          }

          var height = byCodes('8302-2');
          var systolicbp = getBloodPressureValue(byCodes('55284-4'),'8480-6');
          var diastolicbp = getBloodPressureValue(byCodes('55284-4'),'8462-4');
          var hdl = byCodes('2085-9');
          var ldl = byCodes('2089-1');

          var p = defaultPatient();

          p.ehr_patient_id = ehr_patient_id;
          p.patient_email = patient_email;
          p.first_name = first_name;
          p.last_name = last_name;
          p.gender = gender;
          p.dob = dob;
          p.zipcode = zipcode;

        console.log(p);


          p.height = getQuantityValueAndUnit(height[0]);

          if (typeof systolicbp != 'undefined')  {
            p.systolicbp = systolicbp;
          }

          if (typeof diastolicbp != 'undefined') {
            p.diastolicbp = diastolicbp;
          }

          p.hdl = getQuantityValueAndUnit(hdl[0]);
          p.ldl = getQuantityValueAndUnit(ldl[0]);

          ret.resolve(p);
        });
      } else {
        onError();
      }
    }

    FHIR.oauth2.ready(onReady, onError);
    return ret.promise();

  };

  function defaultPatient(){
    return {
      ehr_patient_id: {value:''},
      patient_email: {value:''},
      first_name: {value: ''},
      last_name: {value: ''},
      gender: {value: ''},
      dob: {value: ''},
      zipcode: {value: ''},
      height: {value: ''},
      systolicbp: {value: ''},
      diastolicbp: {value: ''},
      ldl: {value: ''},
      hdl: {value: ''},
    };
  }

  function getBloodPressureValue(BPObservations, typeOfPressure) {
    var formattedBPObservations = [];
    BPObservations.forEach(function(observation){
      var BP = observation.component.find(function(component){
        return component.code.coding.find(function(coding) {
          return coding.code == typeOfPressure;
        });
      });
      if (BP) {
        observation.valueQuantity = BP.valueQuantity;
        formattedBPObservations.push(observation);
      }
    });

    return getQuantityValueAndUnit(formattedBPObservations[0]);
  }

  function getQuantityValueAndUnit(ob) {
    if (typeof ob != 'undefined' &&
        typeof ob.valueQuantity != 'undefined' &&
        typeof ob.valueQuantity.value != 'undefined' &&
        typeof ob.valueQuantity.unit != 'undefined') {
          return ob.valueQuantity.value + ' ' + ob.valueQuantity.unit;
    } else {
      return undefined;
    }
  }


  window.drawVisualization = function(p) {
    $('#holder').show();
    $('#loading').hide();
    $('#ehr_patient_id').html(p.ehr_patient_id);
    $('#patient_email').html(p.patient_email);
    $('#first_name').html(p.first_name);
    $('#last_name').html(p.last_name);
    $('#gender').html(p.gender);
    $('#dob').html(p.dob);
    $('#zipcode').html(p.zipcode);
    $('#height').html(p.height);
    $('#systolicbp').html(p.systolicbp);
    $('#diastolicbp').html(p.diastolicbp);
    $('#ldl').html(p.ldl);
    $('#hdl').html(p.hdl);
 };

})(window);
