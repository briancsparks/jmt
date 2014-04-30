
awk(function() {

  var guids = {
    "5dd1522f-c1da-4dbe-bcd3-0dbb0a83dedc":true,
    "3a30ac63-0b6a-492e-ac42-00410d9b7f58":true,
    "13ae59ad-95ae-4a7b-8754-002f7a0df2a7":true,
    "2d32f6a5-4da6-4783-8b65-025b99784903":true
  };

  var ips = {
    "99.48.33.229" : true,
    "98.200.113.99" : true,
    "76.231.202.45" : true,
    "207.182.143.114": true,
    "74.183.136.21" : true
  };

  eachItem(function(x, xIndex, l, lIndex) {
    var pathParts = x[6].pathname.split("/");

    if (x[2] in ips && pathParts[1] !== "assets") {
      $a.push([x[0], x[2], x[8], x[6].pathname, x[10].pathname]);
    }

    //if (pathParts[1] === "projects") {
    //  if (pathParts[2] in guids) {
    //    histo(x[2])
    //    //$a.push([x[0], x[2], x[8], x[6].pathname, x[10].pathname]);
    //  }
    //}
  });

  //filter(function(x) {
  //  var pathParts = x[6].pathname.split("/");
  //    return  pathParts[1] === "projects" && 
  //            pathParts[2] === "5dd1522f-c1da-4dbe-bcd3-0dbb0a83dedc";
  //  }, 
  //  function(x) {
  //    $a.push([x[0], x[6].pathname]);
  //    //histo(x[6].pathname.split("/")[3]);
  //  }
  //);

});

