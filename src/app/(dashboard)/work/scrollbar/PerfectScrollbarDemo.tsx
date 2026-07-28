"use client"
import PerfectScrollbar from "react-perfect-scrollbar"
import "react-perfect-scrollbar/dist/css/styles.css"

const loremText = `Sweet roll I love I love. Tiramisu I love soufflé cake tart sweet roll cotton candy cookie.
Macaroon biscuit dessert. Bonbon cake soufflé jelly gummi bears lemon drops. Chocolate bar I love macaroon danish candy pudding.
Jelly carrot cake I love tart cake bear claw macaroon candy candy canes. Muffin gingerbread sweet jujubes croissant sweet roll.
Topping muffin carrot cake sweet. Toffee chocolate muffin I love croissant. Donut carrot cake ice cream ice cream.
Wafer I love pie danish marshmallow cheesecake oat cake pie I love. Icing pie chocolate marzipan jelly ice cream cake.
Marzipan oat cake caramels chocolate. Lemon drops cheesecake jelly beans sweet icing pudding croissant.
Donut candy canes carrot cake soufflé. Croissant candy wafer pie I love oat cake lemon drops caramels jujubes.
I love macaroon halvah liquorice cake. Danish sweet roll pudding cookie sweet roll I love.
Jelly cake I love bear claw jujubes dragée gingerbread. I love cotton candy carrot cake halvah biscuit.`

export default function PerfectScrollbarPage() {
  return (
    <div className="row gy-6">
      {/* Vertical */}
      <div className="col-md-6 col-sm-12">
        <div className="card overflow-hidden" style={{ height: 300 }}>
          <h5 className="card-header">Vertical Scrollbar</h5>
          <PerfectScrollbar className="card-body">
            {loremText.split("\n").map((p, i) => <p key={i}>{p}</p>)}
          </PerfectScrollbar>
        </div>
      </div>

      {/* Horizontal */}
      <div className="col-md-6 col-sm-12">
        <div className="card overflow-hidden" style={{ height: 300 }}>
          <h5 className="card-header">Horizontal Scrollbar</h5>
          <PerfectScrollbar className="card-body" options={{ suppressScrollY: true }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/sneat/img/backgrounds/1.jpg" alt="scrollbar" style={{ maxWidth: "none" }} />
          </PerfectScrollbar>
        </div>
      </div>

      {/* Both */}
      <div className="col-12">
        <div className="card overflow-hidden" style={{ height: 500 }}>
          <h5 className="card-header">Vertical &amp; Horizontal Scrollbars</h5>
          <PerfectScrollbar className="card-body">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/sneat/img/backgrounds/1.jpg" alt="scrollbar" style={{ maxWidth: "none" }} />
          </PerfectScrollbar>
        </div>
      </div>
    </div>
  )
}
