# Service Agreement

This agreement takes place between {{client.name}} and {{supplier.name}}.

## General Terms

1. General
2. Terms
3. Go
4. Here

---dhall

let Template : Type =
  {
    source : Text,
    sha256 : Text
  }

let Signatory : Type =
  {
    id : Text,
    name : Text
  }

let Company : Type =
  {
    name : Text,
    signatories : List Signatory
  }

let template : Template =
  {
    source : "file://./template.md",
    sha256 : "6c97dfc331c33ea0883f6338c10e1745e1c6d76a9ba654ab1c4753d2738ac1f8"
  }

let client : Company =
  {
    name = "Company A",
    signatories = [
      {
        id = "manderson",
        name = "Michael Anderson"
      }
    ]
  }

let supplier : Company =
  {
    name = "Company B",
    signatories = [
      {
        id = "gmichaels",
        name = "Gary Michaels"
      }
    ]
  }

in {
  template,
  client,
  supplier
}

---signature:manderson
wsFcBAABCAAQBQJeRwpaCRCNz4IP9epiQgAApd8QABGaynqPL/RGkMmTejkYo/0v
SG3qEvL7vN7jTLS/9+rOvrDcVK5liNJ8N2YGkuhrICWY7HdPTGnftQoOQk6SEk9R
h/qKnJFDVgs6aAcO6/tfEukdstcURHK66+WbBzTxQjr5aOLOkwAi2OIDh816/EZg
oBssjz9p0rbiN82lT1E+KKFWO1H0sqNMAXf8pP+PDTj7PmvH0Ly+D2Abwl6vfcy/
L1FLuEYfCNVC0co0zQ/Q85++vEhKsAHKuCZ2Ok+0wQ0SJ5rRjqIkIiHzwHE1SB1c
46qqTjusjFr9ZIYhXcRgWbPAWnHPPbXncKuCub7NIz23/gIslSkw2r8aArss0HSA
A7J2R0Kd5OKEbxHKokyWCYj0F7omGJsztg0zIsXVIZgSrrQt/Ky0MwVpKAwNGoWA
qmflTIH1FdK0wG6yYseCiWKpy1INsd0MtgETA13EzoRr05Vs1zeF8zXKxC5UlUqW
hj4OV7b2HAZFYPhsgMxf70dCEMmJY3bfIAgJk2MJdsuDZo97V2apy4BxNOLRJMU3
/stfzHLuZVJ6sVgPn/V6TyuqbD8cA13/xQ1Yc4v2N0Klq3DxKhjxhYuf1dK3sA6Q
yWFOerQgz0SlsWlMARR4ro6+pgUni9WjlSu+nL/ngyTQ1FPruh7GVF5E830Q6Y26
4cZUuEcUTlHJzL9nM4yz
=/Ygu

---signature:gmichaels
wsFcBAABCAAQBQJeRwpaCRCNz4IP9epiQgAApd8QABGaynqPL/RGkMmTejkYo/0v
SG3qEvL7vN7jTLS/9+rOvrDcVK5liNJ8N2YGkuhrICWY7HdPTGnftQoOQk6SEk9R
h/qKnJFDVgs6aAcO6/tfEukdstcURHK66+WbBzTxQjr5aOLOkwAi2OIDh816/EZg
oBssjz9p0rbiN82lT1E+KKFWO1H0sqNMAXf8pP+PDTj7PmvH0Ly+D2Abwl6vfcy/
L1FLuEYfCNVC0co0zQ/Q85++vEhKsAHKuCZ2Ok+0wQ0SJ5rRjqIkIiHzwHE1SB1c
46qqTjusjFr9ZIYhXcRgWbPAWnHPPbXncKuCub7NIz23/gIslSkw2r8aArss0HSA
A7J2R0Kd5OKEbxHKokyWCYj0F7omGJsztg0zIsXVIZgSrrQt/Ky0MwVpKAwNGoWA
qmflTIH1FdK0wG6yYseCiWKpy1INsd0MtgETA13EzoRr05Vs1zeF8zXKxC5UlUqW
hj4OV7b2HAZFYPhsgMxf70dCEMmJY3bfIAgJk2MJdsuDZo97V2apy4BxNOLRJMU3
/stfzHLuZVJ6sVgPn/V6TyuqbD8cA13/xQ1Yc4v2N0Klq3DxKhjxhYuf1dK3sA6Q
yWFOerQgz0SlsWlMARR4ro6+pgUni9WjlSu+nL/ngyTQ1FPruh7GVF5E830Q6Y26
4cZUuEcUTlHJzL9nM4yz
=/Ygu
